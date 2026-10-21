use crate::{jobs::JobUpdate, snapshot::RepoSnapshot};
use gitcore::CommandRecord;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "kebab-case")]
pub enum Event {
    RepoState(RepoSnapshot),
    CommandLog(CommandRecord),
    Job(JobUpdate),
}
