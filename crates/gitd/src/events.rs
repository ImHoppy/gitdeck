use crate::{github::PrList, jobs::JobUpdate, snapshot::RepoSnapshot, updater::UpdateState};
use gitcore::CommandRecord;
use serde::Serialize;

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
}
