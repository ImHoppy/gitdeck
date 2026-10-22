use crate::{autostart, explorer, file_manager, server::AppState, zoom};
use anyhow::bail;
use gitcore::{
    commands::version::{self, Support},
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::{Path, PathBuf};

pub async fn info(app: &AppState) -> anyhow::Result<Value> {
    let configured = app.config.lock().unwrap().git.clone();
    let live = app.live.lock().await.as_ref().map(|l| l.name.clone());
    let fetch_interval = live.and_then(|n| app.config.lock().unwrap().workspace(&n).map(|w| w.fetch_interval_minutes));
    let version_out = app.runner.run_ok(Path::new("."), version::ARGS).await.ok();
    Ok(json!({
        "keepRunning": app.lifecycle.keep_running(),
        "version": env!("CARGO_PKG_VERSION"),
        "git": configured,
        "gitVersion": version_out.as_ref().map(|o| String::from_utf8_lossy(o).trim().to_string()),
        "gitSupport": version_out.as_deref().and_then(version::parse).map(version::support),
        "gitMinimum": version::display(version::MINIMUM),
        "gitPatched": version::display(version::PATCHED),
        "githubAvatars": app.config.lock().unwrap().github_avatars,
        "githubPrs": app.github.enabled(),
        "editor": app.config.lock().unwrap().editor.clone(),
        "fileManager": app.config.lock().unwrap().file_manager.clone(),
        "fileManagerDetected": tokio::task::spawn_blocking(file_manager::detect).await.ok().flatten(),
        "fetchInterval": fetch_interval,
        "setupDone": app.config.lock().unwrap().setup_done,
        "updates": app.config.lock().unwrap().updates,
        "explorerMenu": tokio::task::spawn_blocking(explorer::is_on).await.ok().flatten(),
        "autostart": tokio::task::spawn_blocking(autostart::is_on).await.unwrap_or(false),
        "update": app.updater.state(),
        "zoom": app.config.lock().unwrap().zoom.unwrap_or(1.0),
    }))
}

#[derive(Deserialize)]
pub struct ZoomParams {
    /// Up (> 0), down (< 0) or back to 100% (0) from the saved level.
    #[serde(default)]
    step: Option<i32>,
    level: Option<f64>,
}

/// Every gitdeck window follows; returns the new level.
pub async fn zoom(app: &AppState, p: ZoomParams) -> anyhow::Result<Value> {
    let level = {
        let mut config = app.config.lock().unwrap();
        let current = config.zoom.unwrap_or(1.0);
        let level = match (p.level, p.step) {
            (Some(level), _) => zoom::clamp(level),
            (None, Some(by)) => zoom::step(current, by),
            (None, None) => current,
        };
        config.zoom = (level != 1.0).then_some(level);
        config.save(&app.config_path)?;
        level
    };
    crate::window::set_zoom(level);
    Ok(json!(level))
}

/// Opening or creating repositories needs the git commands gitdeck runs: refuse a git older than that.
pub async fn require_git(app: &AppState) -> anyhow::Result<()> {
    let out = app.runner.run_ok(Path::new("."), version::ARGS).await.ok();
    if let Some(v) = out.as_deref().and_then(version::parse).filter(|v| version::support(*v) == Support::TooOld) {
        bail!(
            "git {} is too old: gitdeck needs git {} or newer (update git, or set another git executable in Settings)",
            version::display(v),
            version::display(version::MINIMUM)
        );
    }
    Ok(())
}

async fn git_version(app: &AppState) -> Option<String> {
    let out = app.runner.run_ok(Path::new("."), version::ARGS).await.ok()?;
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

pub async fn set_github_prs(app: &AppState, p: AvatarsParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.github_prs = p.on;
        config.save(&app.config_path)?;
    }
    app.github.set_enabled(p.on);
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
