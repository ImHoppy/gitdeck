use gitcore::GitRunner;
use serde::Serialize;
use workspace::{state, RepoEntry, RepoState};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoSnapshot {
    #[serde(flatten)]
    pub entry: RepoEntry,
    pub state: Option<RepoState>,
    pub pointer_differs: bool,
    pub error: Option<String>,
}

impl RepoSnapshot {
    pub async fn load<R: GitRunner>(runner: &R, entry: RepoEntry) -> Self {
        let (state, error) = match entry.initialized {
            true => match state::load(runner, &entry.path).await {
                Ok(s) => (Some(s), None),
                Err(e) => (None, Some(e.to_string())),
            },
            false => (None, None),
        };
        let head_sha = state.as_ref().and_then(|s| s.head_sha.as_ref());
        let pointer_differs = matches!((&entry.recorded_sha, head_sha), (Some(r), Some(h)) if r != h);
        Self { entry, state, pointer_differs, error }
    }
}
