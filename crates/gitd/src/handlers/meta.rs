use crate::server::AppState;
use anyhow::bail;
use gitcore::GitRunner;
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;

pub async fn info(app: &AppState) -> anyhow::Result<Value> {
    let configured = app.config.lock().unwrap().git.clone();
    let live = app.live.lock().await.as_ref().map(|l| l.name.clone());
    let fetch_interval = live.and_then(|n| app.config.lock().unwrap().workspace(&n).map(|w| w.fetch_interval_minutes));
    Ok(json!({
        "keepRunning": app.lifecycle.keep_running(),
        "version": env!("CARGO_PKG_VERSION"),
        "git": configured,
        "gitVersion": git_version(app).await,
        "githubAvatars": app.config.lock().unwrap().github_avatars,
        "editor": app.config.lock().unwrap().editor.clone(),
        "fileManager": app.config.lock().unwrap().file_manager.clone(),
        "fetchInterval": fetch_interval,
    }))
}

async fn git_version(app: &AppState) -> Option<String> {
    let out = app.runner.run_ok(std::path::Path::new("."), &["--version"]).await.ok()?;
    Some(String::from_utf8_lossy(&out).trim().to_string())
}

#[derive(Deserialize)]
pub struct KeepParams {
    on: bool,
}

pub async fn keep_running(app: &AppState, p: KeepParams) -> anyhow::Result<Value> {
    app.lifecycle.set_keep_running(p.on);
    info(app).await
}

#[derive(Deserialize)]
pub struct GitParams {
    /// Empty or missing: `git` from PATH.
    path: Option<String>,
}

/// Switches the git executable, keeping the old one when the new one doesn't answer `--version`.
pub async fn set_git(app: &AppState, p: GitParams) -> anyhow::Result<Value> {
    let path = p.path.map(|s| s.trim().trim_matches('"').to_string()).filter(|s| !s.is_empty()).map(PathBuf::from);
    let old = app.config.lock().unwrap().git.clone();
    app.runner.set_git(path.clone());
    if git_version(app).await.is_none() {
        app.runner.set_git(old);
        bail!("{} does not run as git", path.map_or("git".into(), |p| p.display().to_string()));
    }
    {
        let mut config = app.config.lock().unwrap();
        config.git = path;
        config.save(&app.config_path)?;
    }
    info(app).await
}

#[derive(Deserialize)]
pub struct FetchIntervalParams {
    minutes: u64,
}

pub async fn set_fetch_interval(app: &AppState, p: FetchIntervalParams) -> anyhow::Result<Value> {
    {
        let mut live = app.live.lock().await;
        let Some(live) = live.as_mut() else { bail!("no project open") };
        let mut config = app.config.lock().unwrap();
        config.set_fetch_interval(&live.name, p.minutes);
        config.save(&app.config_path)?;
        live.set_fetch_interval(std::time::Duration::from_secs(p.minutes * 60));
    }
    info(app).await
}

#[derive(Deserialize)]
pub struct AvatarsParams {
    on: bool,
}

pub async fn set_avatars(app: &AppState, p: AvatarsParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.github_avatars = p.on;
        config.save(&app.config_path)?;
    }
    info(app).await
}

#[derive(Deserialize)]
pub struct EditorParams {
    /// Empty or missing: VS Code's `code` from PATH.
    path: Option<String>,
}

pub async fn set_editor(app: &AppState, p: EditorParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.editor = p.path.map(|s| s.trim().trim_matches('"').to_string()).filter(|s| !s.is_empty());
        config.save(&app.config_path)?;
    }
    info(app).await
}

/// Empty or missing: the system file manager.
pub async fn set_file_manager(app: &AppState, p: EditorParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.file_manager = p.path.map(|s| s.trim().trim_matches('"').to_string()).filter(|s| !s.is_empty());
        config.save(&app.config_path)?;
    }
    info(app).await
}

pub async fn jobs(app: &AppState) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(super::repo::hub(app).await?.jobs.list())?)
}

pub fn commands(app: &AppState) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(app.commands.recent())?)
}
