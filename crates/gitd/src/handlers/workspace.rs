use crate::{handlers::repo::hub, hub::Hub, live::LiveWorkspace, server::AppState};
use anyhow::Context;
use futures::future::join_all;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{sync::Arc, time::Duration};
use workspace::{discovery, watch::WatchTarget};

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
    let hub = Arc::new(Hub::new(app.runner.clone(), app.events.clone(), &repos));
    let snapshots = join_all(repos.into_iter().map(|entry| hub.snapshot(entry))).await;
    let targets = snapshots
        .iter()
        .filter(|s| s.entry.initialized && !s.entry.excluded)
        .map(|s| WatchTarget {
            id: s.entry.id,
            worktree: s.entry.path.clone(),
            gitdir: s.state.as_ref().map(|st| st.gitdir.clone()),
        })
        .collect();
    let interval = Duration::from_secs(ws.fetch_interval_minutes * 60);
    *app.live.lock().await = Some(LiveWorkspace::start(hub, targets, interval)?);
    Ok(json!({ "name": ws.name, "repos": snapshots }))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchStaleParams {
    older_than_secs: u64,
}

pub async fn fetch_stale(app: &AppState, p: FetchStaleParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    Ok(serde_json::to_value(hub.fetch(hub.stale(p.older_than_secs)).await)?)
}
