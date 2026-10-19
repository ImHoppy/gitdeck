use crate::{events::Event, snapshot::RepoSnapshot};
use gitcore::ProcessRunner;
use std::{collections::HashMap, sync::Arc};
use tokio::{sync::{broadcast, mpsc}, task::JoinHandle};
use workspace::{
    watch::{RepoWatcher, WatchTarget},
    RepoEntry, RepoId,
};

pub struct LiveWorkspace {
    _watcher: RepoWatcher,
    refresher: JoinHandle<()>,
}

impl Drop for LiveWorkspace {
    fn drop(&mut self) {
        self.refresher.abort();
    }
}

impl LiveWorkspace {
    pub fn start(
        snapshots: &[RepoSnapshot],
        runner: ProcessRunner,
        events: broadcast::Sender<Event>,
    ) -> notify::Result<Self> {
        let targets = snapshots
            .iter()
            .filter(|s| s.entry.initialized && !s.entry.excluded)
            .map(|s| WatchTarget {
                id: s.entry.id,
                worktree: s.entry.path.clone(),
                gitdir: s.state.as_ref().map(|st| st.gitdir.clone()),
            })
            .collect();
        let entries: Arc<HashMap<RepoId, RepoEntry>> =
            Arc::new(snapshots.iter().map(|s| (s.entry.id, s.entry.clone())).collect());
        let (tx, rx) = mpsc::unbounded_channel();
        let watcher = RepoWatcher::start(targets, tx)?;
        let refresher = tokio::spawn(refresh_loop(rx, entries, runner, events));
        Ok(Self { _watcher: watcher, refresher })
    }
}

async fn refresh_loop(
    mut changed: mpsc::UnboundedReceiver<Vec<RepoId>>,
    entries: Arc<HashMap<RepoId, RepoEntry>>,
    runner: ProcessRunner,
    events: broadcast::Sender<Event>,
) {
    while let Some(ids) = changed.recv().await {
        for id in ids {
            let Some(entry) = entries.get(&id).cloned() else { continue };
            let (runner, events) = (runner.clone(), events.clone());
            tokio::spawn(async move {
                let snapshot = RepoSnapshot::load(&runner, entry).await;
                let _ = events.send(Event::RepoState(snapshot));
            });
        }
    }
}
