use serde::Serialize;
use std::path::PathBuf;

pub type RepoId = u32;

#[derive(Debug, Clone, Serialize)]
pub struct RepoEntry {
    pub id: RepoId,
    pub parent: Option<RepoId>,
    pub path: PathBuf,
    pub path_in_parent: Option<String>,
    pub name: String,
    pub initialized: bool,
    pub pointer_differs: bool,
    pub excluded: bool,
}
