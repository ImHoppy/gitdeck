use crate::{live::LiveWorkspace, server::AppState, snapshot::RepoSnapshot};
use anyhow::Context;
use futures::future::join_all;
use serde::Deserialize;
use serde_json::{json, Value};
use workspace::discovery;

pub fn list(app: &AppState) -> anyhow::Result<Value> {
    let names: Vec<&str> = app.config.workspaces.iter().map(|w| w.name.as_str()).collect();
    Ok(json!(names))
}

#[derive(Deserialize)]
pub struct OpenParams {
    name: String,
}

pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let ws = app
        .config
        .workspace(&p.name)
        .with_context(|| format!("no workspace {}", p.name))?;
    let repos = discovery::discover(&app.runner, ws).await?;
    let snapshots = join_all(repos.into_iter().map(|entry| RepoSnapshot::load(&app.runner, entry))).await;
    let live = LiveWorkspace::start(&snapshots, app.runner.clone(), app.events.clone())?;
    *app.live.lock().await = Some(live);
    Ok(json!({ "name": ws.name, "repos": snapshots }))
}
