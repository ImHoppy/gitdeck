use crate::{events::Event, snapshot::RepoSnapshot};
use futures::future::join_all;
use gitcore::ProcessRunner;
use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::broadcast;
use workspace::{
    bulk,
    fetch_log::FetchLog,
    sync::{self, RebaseAction, SyncKind, SyncOutcome},
    RepoEntry, RepoId, Scheduler,
};

/// Everything an open workspace needs to run git on its repos and tell clients about it.
pub struct Hub {
    pub runner: ProcessRunner,
    pub entries: HashMap<RepoId, RepoEntry>,
    events: broadcast::Sender<Event>,
    scheduler: Scheduler,
    fetch_log: FetchLog,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoResult {
    pub id: RepoId,
    pub outcome: SyncOutcome,
}

impl Hub {
    pub fn new(runner: ProcessRunner, events: broadcast::Sender<Event>, entries: &[RepoEntry]) -> Self {
        Self {
            runner,
            entries: entries.iter().map(|e| (e.id, e.clone())).collect(),
            events,
            scheduler: Scheduler::default(),
            fetch_log: FetchLog::default(),
        }
    }

    pub async fn snapshot(&self, entry: RepoEntry) -> RepoSnapshot {
        let mut snapshot = RepoSnapshot::load(&self.runner, entry).await;
        snapshot.last_fetch = self.fetch_log.get(snapshot.entry.id);
        snapshot
    }

    pub async fn publish(&self, id: RepoId) {
        if let Some(entry) = self.entries.get(&id) {
            let _ = self.events.send(Event::RepoState(self.snapshot(entry.clone()).await));
        }
    }

    pub fn active(&self) -> impl Iterator<Item = &RepoEntry> {
        self.entries.values().filter(|e| e.initialized && !e.excluded)
    }

    pub fn stale(&self, secs: u64) -> Vec<RepoId> {
        self.active().filter(|e| self.fetch_log.older_than(e.id, secs)).map(|e| e.id).collect()
    }

    pub async fn sync(&self, id: RepoId, kind: SyncKind) -> SyncOutcome {
        let Some(entry) = self.entries.get(&id) else {
            return SyncOutcome::Failed { message: format!("no repo {id}") };
        };
        let outcome = self.scheduler.write(id, sync::run(&self.runner, &entry.path, kind)).await;
        if matches!(kind, SyncKind::Fetch) && !matches!(outcome, SyncOutcome::Skipped { .. }) {
            self.fetch_log.record(id, outcome.clone());
        }
        self.publish(id).await;
        outcome
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
        join_all(ids.into_iter().map(|id| async move {
            RepoResult { id, outcome: self.sync(id, SyncKind::Fetch).await }
        }))
        .await
    }

    /// Submodules run before their superproject; one repo's failure never stops the others.
    pub async fn sync_all(&self, kind: SyncKind) -> Vec<RepoResult> {
        let mut results: Vec<RepoResult> = self
            .entries
            .values()
            .filter(|e| !e.initialized || e.excluded)
            .map(|e| RepoResult {
                id: e.id,
                outcome: SyncOutcome::Skipped {
                    reason: if e.excluded { "excluded" } else { "not initialized" }.into(),
                },
            })
            .collect();
        let active: Vec<RepoEntry> = self.active().cloned().collect();
        for wave in bulk::waves(&active) {
            results.extend(
                join_all(wave.into_iter().map(|id| async move {
                    RepoResult { id, outcome: self.sync(id, kind).await }
                }))
                .await,
            );
        }
        results
    }
}
