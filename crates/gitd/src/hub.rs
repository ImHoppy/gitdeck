use crate::{events::Event, histories::Histories, jobs::Jobs, snapshot::RepoSnapshot};
use futures::future::join_all;
use gitcore::{commands::gitlinks, GitOutput, GitRunner, ProcessRunner};
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::broadcast;
use workspace::{
    bulk,
    fetch_log::FetchLog,
    sync::{self, RebaseAction, SyncKind, SyncOutcome},
    RepoEntry, RepoId, Scheduler,
};

pub struct Hub {
    pub runner: ProcessRunner,
    pub entries: HashMap<RepoId, RepoEntry>,
    pub histories: Histories,
    pub jobs: Jobs,
    events: broadcast::Sender<Event>,
    scheduler: Scheduler,
    fetch_log: FetchLog,
    latest: std::sync::Mutex<HashMap<RepoId, RepoSnapshot>>,
    written: std::sync::Mutex<HashMap<RepoId, std::time::Instant>>,
}

/// How long after a write the watcher's echo of it (the index file changing) is expected.
const WRITE_ECHO: std::time::Duration = std::time::Duration::from_secs(2);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoResult {
    pub id: RepoId,
    pub outcome: SyncOutcome,
    pub submodules_moved: Vec<String>,
}

impl RepoResult {
    fn of(id: RepoId, outcome: SyncOutcome) -> Self {
        Self { id, outcome, submodules_moved: Vec::new() }
    }
}

impl Hub {
    pub fn new(runner: ProcessRunner, events: broadcast::Sender<Event>, entries: &[RepoEntry]) -> Self {
        Self {
            runner,
            entries: entries.iter().map(|e| (e.id, e.clone())).collect(),
            jobs: Jobs::new(events.clone()),
            events,
            histories: Histories::default(),
            scheduler: Scheduler::default(),
            fetch_log: FetchLog::default(),
            latest: Default::default(),
            written: Default::default(),
        }
    }

    pub fn busy(&self) -> bool {
        self.scheduler.busy()
    }

    pub fn entry(&self, id: RepoId) -> anyhow::Result<&RepoEntry> {
        self.entries.get(&id).ok_or_else(|| anyhow::anyhow!("no repo {id}"))
    }

    pub async fn snapshot(&self, entry: RepoEntry) -> RepoSnapshot {
        let mut snapshot = RepoSnapshot::load(&self.runner, entry).await;
        snapshot.last_fetch = self.fetch_log.get(snapshot.entry.id);
        self.latest.lock().unwrap_or_else(|e| e.into_inner()).insert(snapshot.entry.id, snapshot.clone());
        snapshot
    }

    /// Every repo's last published snapshot (kept fresh by the watcher), loading any still missing.
    pub async fn snapshots(&self) -> Vec<RepoSnapshot> {
        let known = self.latest.lock().unwrap_or_else(|e| e.into_inner()).clone();
        join_all(self.entries().into_iter().map(|entry| async {
            match known.get(&entry.id) {
                Some(s) => s.clone(),
                None => self.snapshot(entry).await,
            }
        }))
        .await
    }

    pub async fn publish(&self, id: RepoId) {
        if let Some(entry) = self.entries.get(&id) {
            let _ = self.events.send(Event::RepoState(self.snapshot(entry.clone()).await));
        }
    }

    /// For the watcher: skips the echo of our own write, which would make every client reload again.
    pub async fn publish_if_changed(&self, id: RepoId) {
        let Some(entry) = self.entries.get(&id) else { return };
        let recent = self.written.lock().unwrap_or_else(|e| e.into_inner()).get(&id).is_some_and(|t| t.elapsed() < WRITE_ECHO);
        let before = recent.then(|| self.latest.lock().unwrap_or_else(|e| e.into_inner()).get(&id).map(serde_json::to_value));
        let snapshot = self.snapshot(entry.clone()).await;
        if let Some(Some(Ok(before))) = before {
            if serde_json::to_value(&snapshot).is_ok_and(|now| now == before) {
                return;
            }
        }
        let _ = self.events.send(Event::RepoState(snapshot));
    }

    fn mark_written(&self, id: RepoId) {
        self.written.lock().unwrap_or_else(|e| e.into_inner()).insert(id, std::time::Instant::now());
    }

    /// Every repo in discovery order (ids are handed out in that order).
    pub fn entries(&self) -> Vec<RepoEntry> {
        let mut all: Vec<RepoEntry> = self.entries.values().cloned().collect();
        all.sort_by_key(|e| e.id);
        all
    }

    pub fn active(&self) -> impl Iterator<Item = &RepoEntry> {
        self.entries.values().filter(|e| e.initialized && !e.excluded)
    }

    pub fn stale(&self, secs: u64) -> Vec<RepoId> {
        self.active().filter(|e| self.fetch_log.older_than(e.id, secs)).map(|e| e.id).collect()
    }

    pub async fn sync(&self, id: RepoId, kind: SyncKind) -> RepoResult {
        self.sync_job(id, kind, false).await
    }

    async fn sync_job(&self, id: RepoId, kind: SyncKind, background: bool) -> RepoResult {
        let Some(entry) = self.entries.get(&id) else {
            return RepoResult::of(id, SyncOutcome::Failed { message: format!("no repo {id}") });
        };
        let pulls = matches!(kind, SyncKind::Pull | SyncKind::Sync);
        let job = async {
            let before = if pulls { sync::gitlinks(&self.runner, &entry.path).await } else { Vec::new() };
            let title = format!("{kind:?} {}", entry.name);
            let outcome = self.jobs.run(id, title, background, sync::run(&self.runner, &entry.path, kind)).await;
            let moved = match outcome {
                SyncOutcome::Done | SyncOutcome::UpToDate if pulls => {
                    gitlinks::moved(&before, &sync::gitlinks(&self.runner, &entry.path).await)
                }
                _ => Vec::new(),
            };
            RepoResult { id, outcome, submodules_moved: moved }
        };
        let result = self.scheduler.write(id, job).await;
        if matches!(kind, SyncKind::Fetch) && !matches!(result.outcome, SyncOutcome::Skipped { .. }) {
            self.fetch_log.record(id, result.outcome.clone());
        }
        self.publish(id).await;
        result
    }

    pub async fn queued<T>(&self, id: RepoId, job: impl std::future::Future<Output = T>) -> T {
        let out = self.scheduler.write(id, job).await;
        self.mark_written(id);
        self.publish(id).await;
        out
    }

    pub async fn write_git(&self, id: RepoId, args: Vec<String>) -> anyhow::Result<GitOutput> {
        let entry = self.entry(id)?;
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let out = self.scheduler.write(id, self.runner.run(&entry.path, &args)).await;
        self.mark_written(id);
        self.publish(id).await;
        let out = out?;
        if !out.ok() {
            anyhow::bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
        }
        Ok(out)
    }

    pub async fn update_submodules(&self, id: RepoId) -> SyncOutcome {
        let Some(entry) = self.entries.get(&id) else {
            return SyncOutcome::Failed { message: format!("no repo {id}") };
        };
        let outcome = self.scheduler.write(id, sync::update_submodules(&self.runner, &entry.path)).await;
        let children: Vec<RepoId> = self.entries.values().filter(|e| e.parent == Some(id)).map(|e| e.id).collect();
        join_all(std::iter::once(id).chain(children).map(|id| self.publish(id))).await;
        outcome
    }

    pub async fn conflicts(&self, id: RepoId) -> anyhow::Result<Vec<String>> {
        let entry = self.entries.get(&id).ok_or_else(|| anyhow::anyhow!("no repo {id}"))?;
        Ok(sync::conflicts(&self.runner, &entry.path).await?)
    }

    pub async fn rebase(&self, id: RepoId, action: RebaseAction) -> SyncOutcome {
        let Some(entry) = self.entries.get(&id) else {
            return SyncOutcome::Failed { message: format!("no repo {id}") };
        };
        let outcome = self.scheduler.write(id, sync::rebase(&self.runner, &entry.path, action)).await;
        self.publish(id).await;
        outcome
    }

    pub async fn fetch(&self, ids: Vec<RepoId>) -> Vec<RepoResult> {
        join_all(ids.into_iter().map(|id| self.sync_job(id, SyncKind::Fetch, true))).await
    }

    pub async fn sync_all(&self, kind: SyncKind) -> Vec<RepoResult> {
        let mut results: Vec<RepoResult> = self
            .entries
            .values()
            .filter(|e| !e.initialized || e.excluded)
            .map(|e| {
                let reason = if e.excluded { "excluded" } else { "not initialized" };
                RepoResult::of(e.id, SyncOutcome::Skipped { reason: reason.into() })
            })
            .collect();
        let active: Vec<RepoEntry> = self.active().cloned().collect();
        for wave in bulk::waves(&active) {
            results.extend(join_all(wave.into_iter().map(|id| self.sync(id, kind))).await);
        }
        results
    }
}
