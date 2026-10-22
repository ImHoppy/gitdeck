use crate::{github::PrList, jobs::JobUpdate, snapshot::RepoSnapshot, updater::UpdateState};
use gitcore::CommandRecord;
use serde::Serialize;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "kebab-case")]
pub enum Event {
    RepoState(RepoSnapshot),
    CommandLog(CommandRecord),
    Job(JobUpdate),
    PullRequests(PrList),
    /// From one window to the others: select this commit or branch in the history.
    Navigate(serde_json::Value),
    Update(UpdateState),
    Zoom(f64),
}

/// A workspace event, tagged with its workspace's name.
pub type Scoped = (Arc<str>, Event);

/// The events of one workspace's repos and jobs: only the windows showing it receive them, since
/// repo ids of two workspaces overlap.
#[derive(Clone)]
pub struct WorkspaceEvents {
    name: Arc<str>,
    tx: broadcast::Sender<Scoped>,
}

impl WorkspaceEvents {
    pub fn new(name: &str, tx: broadcast::Sender<Scoped>) -> Self {
        Self { name: name.into(), tx }
    }

    pub fn send(&self, event: Event) {
        let _ = self.tx.send((self.name.clone(), event));
    }
}
