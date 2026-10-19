use crate::snapshot::RepoSnapshot;
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "event", content = "data", rename_all = "kebab-case")]
pub enum Event {
    RepoState(RepoSnapshot),
}
