use crate::{handlers::repo::hub, hub::Hub, live::LiveWorkspace, server::AppState};
use anyhow::{bail, Context};
use futures::future::join_all;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc, time::Duration};
use gitcore::GitRunner;
use workspace::{discovery, watch::WatchTarget, Config};

pub fn list(app: &AppState) -> anyhow::Result<Value> {
    let config = app.config.lock().unwrap();
    let names: Vec<&str> = config.workspaces.iter().map(|w| w.name.as_str()).collect();
    Ok(json!(names))
}

#[derive(Deserialize)]
pub struct OpenParams {
    name: String,
}

pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let ws = app
        .config
        .lock()
        .unwrap()
        .workspace(&p.name)
        .cloned()
        .with_context(|| format!("no workspace {}", p.name))?;
    let repos = discovery::discover(&app.runner, &ws).await?;
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
pub struct RootParams {
    name: String,
    path: PathBuf,
}

/// Adds the repo containing `path` (its top level) as a root of workspace `name`.
pub async fn add_root(app: &AppState, p: RootParams) -> anyhow::Result<Value> {
    let out = app.runner.run(&p.path, &["rev-parse", "--show-toplevel"]).await?;
    if !out.ok() {
        bail!("{} is not inside a git repository", p.path.display());
    }
    let top = PathBuf::from(String::from_utf8_lossy(&out.stdout).trim());
    edit_config(app, |c| c.add_root(&p.name, top))?;
    list(app)
}

pub fn remove_root(app: &AppState, p: RootParams) -> anyhow::Result<Value> {
    edit_config(app, |c| c.remove_root(&p.name, &p.path))?;
    list(app)
}

#[derive(Deserialize)]
pub struct ExcludeParams {
    name: String,
    path: PathBuf,
    excluded: bool,
}

pub fn exclude(app: &AppState, p: ExcludeParams) -> anyhow::Result<Value> {
    edit_config(app, |c| c.set_excluded(&p.name, &p.path, p.excluded))?;
    Ok(Value::Null)
}

fn edit_config(app: &AppState, edit: impl FnOnce(&mut Config)) -> anyhow::Result<()> {
    let mut config = app.config.lock().unwrap();
    edit(&mut config);
    config.save(&app.config_path)?;
    Ok(())
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
