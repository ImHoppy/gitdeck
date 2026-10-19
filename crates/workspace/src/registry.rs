use serde::Serialize;
use std::path::PathBuf;

pub type RepoId = u32;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoEntry {
    pub id: RepoId,
    pub parent: Option<RepoId>,
    pub path: PathBuf,
    pub path_in_parent: Option<String>,
    pub name: String,
    pub recorded_sha: Option<String>,
    pub initialized: bool,
    pub excluded: bool,
}
