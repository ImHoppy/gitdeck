use crate::server::AppState;
use anyhow::{anyhow, Context};
use futures::future::join_all;
use gitcore::{ProcessRunner, RunError};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use workspace::{discovery, state, RepoEntry, RepoState};

pub async fn dispatch(app: &AppState, method: &str, params: Value) -> anyhow::Result<Value> {
    match method {
        "workspace.list" => workspace_list(app),
        "workspace.open" => workspace_open(app, serde_json::from_value(params)?).await,
        _ => Err(anyhow!("unknown method {method}")),
    }
}

fn workspace_list(app: &AppState) -> anyhow::Result<Value> {
    let names: Vec<&str> = app.config.workspaces.iter().map(|w| w.name.as_str()).collect();
    Ok(json!(names))
}

#[derive(Deserialize)]
struct OpenParams {
    name: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoSnapshot {
    #[serde(flatten)]
    entry: RepoEntry,
    state: Option<RepoState>,
    pointer_differs: bool,
    error: Option<String>,
}

impl RepoSnapshot {
    fn new(entry: RepoEntry, loaded: Option<Result<RepoState, RunError>>) -> Self {
        let (state, error) = match loaded {
            Some(Ok(s)) => (Some(s), None),
            Some(Err(e)) => (None, Some(e.to_string())),
            None => (None, None),
        };
        let pointer_differs = match (&entry.recorded_sha, state.as_ref().and_then(|s| s.head_sha.as_ref())) {
            (Some(recorded), Some(head)) => recorded != head,
            _ => false,
        };
        Self { entry, state, pointer_differs, error }
    }
}

async fn workspace_open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let ws = app
        .config
        .workspace(&p.name)
        .with_context(|| format!("no workspace {}", p.name))?;
    let runner = ProcessRunner::default();
    let repos = discovery::discover(&runner, ws).await?;
    let snapshots = join_all(repos.into_iter().map(|entry| {
        let runner = runner.clone();
        async move {
            let loaded = match entry.initialized {
                true => Some(state::load(&runner, &entry.path).await),
                false => None,
            };
            RepoSnapshot::new(entry, loaded)
        }
    }))
    .await;
    Ok(json!({ "name": ws.name, "repos": snapshots }))
}
