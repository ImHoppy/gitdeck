use crate::{handlers::repo::hub, hub::Hub, live::LiveWorkspace, server::AppState};
use anyhow::{bail, Context};
use futures::future::join_all;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, sync::Arc, time::Duration};
use gitcore::{commands::ignored, GitRunner};
use workspace::{discovery, watch::WatchTarget, Config};

pub fn list(app: &AppState) -> anyhow::Result<Value> {
    let config = app.config.lock().unwrap();
    let names: Vec<&str> = config.workspaces.iter().map(|w| w.name.as_str()).collect();
    Ok(json!(names))
}

#[derive(Deserialize)]
pub struct OpenParams {
    name: String,
    /// Rediscover even when this workspace is already live (after its roots changed).
    #[serde(default)]
    reload: bool,
}

pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let ws = app
        .config
        .lock()
        .unwrap()
        .workspace(&p.name)
        .cloned()
        .with_context(|| format!("no workspace {}", p.name))?;
    // another window already has it open: share it instead of restarting the watchers
    if !p.reload {
        let live = app.live.lock().await.as_ref().filter(|l| l.name == ws.name).map(|l| l.hub.clone());
        if let Some(hub) = live {
            return Ok(json!({ "name": ws.name, "repos": hub.snapshots().await, "nestedRoots": nested_roots(&ws) }));
        }
    }
    let repos = discovery::discover(&app.runner, &ws).await?;
    let hub = Arc::new(Hub::new(app.runner.clone(), app.events.clone(), &repos));
    let snapshots = join_all(repos.into_iter().map(|entry| hub.snapshot(entry))).await;
    let targets: Vec<WatchTarget> = snapshots
        .iter()
        .filter(|s| s.entry.initialized && !s.entry.excluded)
        .map(|s| WatchTarget {
            id: s.entry.id,
            worktree: s.entry.path.clone(),
            gitdir: s.state.as_ref().map(|st| st.gitdir.clone()),
            ignored: Vec::new(),
        })
        .collect();
    let worktrees: Vec<PathBuf> = targets.iter().map(|t| t.worktree.clone()).collect();
    let interval = Duration::from_secs(ws.fetch_interval_minutes * 60);
    let live = LiveWorkspace::start(ws.name.clone(), hub, targets, interval, app.lifecycle.clients())?;
    // listing ignored files can take most of a second per repo: the page needn't wait for it
    let ignore = live.ignore_list();
    let runner = app.runner.clone();
    tokio::spawn(async move {
        join_all(worktrees.iter().map(|wt| async {
            if let Ok(out) = runner.run_ok(wt, ignored::ARGS).await {
                ignore.add(wt, ignored::parse(&out).into_iter().map(PathBuf::from));
            }
        }))
        .await;
    });
    *app.live.lock().await = Some(live);
    Ok(json!({ "name": ws.name, "repos": snapshots, "nestedRoots": nested_roots(&ws) }))
}

/// The roots whose inner clones are shown too, so the tree can offer turning it off.
fn nested_roots(ws: &workspace::WorkspaceConfig) -> Vec<&PathBuf> {
    ws.roots.iter().filter(|r| r.nested).map(|r| &r.path).collect()
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
pub struct NestedParams {
    name: String,
    path: PathBuf,
    on: bool,
}

pub fn set_nested(app: &AppState, p: NestedParams) -> anyhow::Result<Value> {
    let mut found = false;
    edit_config(app, |c| found = c.set_nested(&p.name, &p.path, p.on))?;
    if !found {
        bail!("{} is not a folder of {}: add it first", p.path.display(), p.name);
    }
    Ok(Value::Null)
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
