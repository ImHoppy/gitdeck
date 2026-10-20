use crate::server::AppState;
use anyhow::{bail, Context};
use gitcore::{
    commands::{clone, init},
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, time::Duration};

const CLONE_TIMEOUT: Duration = Duration::from_secs(30 * 60);

/// Every workspace with its root folders, for the start page.
pub fn recent(app: &AppState) -> anyhow::Result<Value> {
    let config = app.config.lock().unwrap();
    let all: Vec<Value> = config
        .workspaces
        .iter()
        .map(|w| json!({ "name": w.name, "roots": w.roots.iter().map(|r| &r.path).collect::<Vec<_>>() }))
        .collect();
    Ok(json!(all))
}

#[derive(Deserialize)]
pub struct OpenParams {
    path: PathBuf,
}

/// The workspace holding the repo at `path`, adding one named after its folder when none does.
pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let out = app.runner.run(&p.path, &["rev-parse", "--show-toplevel"]).await?;
    if !out.ok() {
        bail!("{} is not inside a git repository", p.path.display());
    }
    let top = PathBuf::from(String::from_utf8_lossy(&out.stdout).trim());
    let mut config = app.config.lock().unwrap();
    let norm = |a: &std::path::Path| a.to_string_lossy().replace('\\', "/").to_lowercase();
    let same = |a: &std::path::Path| norm(a) == norm(&top);
    if let Some(ws) = config.workspaces.iter().find(|w| w.roots.iter().any(|r| same(&r.path))) {
        return Ok(json!(ws.name));
    }
    let base = top.file_name().map_or("repo".to_string(), |n| n.to_string_lossy().into_owned());
    let mut name = base.clone();
    let mut n = 2;
    while config.workspace(&name).is_some() {
        name = format!("{base} {n}");
        n += 1;
    }
    config.add_root(&name, top);
    config.save(&app.config_path)?;
    Ok(json!(name))
}

pub async fn init(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    std::fs::create_dir_all(&p.path).with_context(|| format!("creating {}", p.path.display()))?;
    let args = init::args(&p.path);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    app.runner.run_ok(&p.path, &args).await?;
    open(app, p).await
}

#[derive(Deserialize)]
pub struct CloneParams {
    url: String,
    path: PathBuf,
}

pub async fn clone(app: &AppState, p: CloneParams) -> anyhow::Result<Value> {
    if p.path.exists() && std::fs::read_dir(&p.path)?.next().is_some() {
        bail!("{} already exists and is not empty", p.path.display());
    }
    let parent = p.path.parent().context("no parent folder")?;
    std::fs::create_dir_all(parent)?;
    let mut runner = app.runner.clone();
    runner.timeout = CLONE_TIMEOUT;
    let args = clone::args(&p.url, &p.path);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = runner.run(parent, &args).await?;
    if !out.ok() {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }
    open(app, OpenParams { path: p.path }).await
}

#[derive(Deserialize)]
pub struct DirNameParams {
    url: String,
}

pub fn clone_dir_name(p: DirNameParams) -> anyhow::Result<Value> {
    Ok(json!(clone::default_dir_name(&p.url)))
}

#[derive(Deserialize)]
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub struct PickParams {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    start: Option<PathBuf>,
}

/// The native folder dialog, on the machine gitd runs on; `null` when cancelled.
pub async fn pick_folder(p: PickParams) -> anyhow::Result<Value> {
    #[cfg(not(target_os = "macos"))]
    {
        let picked = tokio::task::spawn_blocking(move || {
            let mut dialog = rfd::FileDialog::new().set_title(p.title.unwrap_or_else(|| "Choose a folder".into()));
            if let Some(start) = p.start.filter(|s| s.is_dir()) {
                dialog = dialog.set_directory(start);
            }
            dialog.pick_folder()
        })
        .await?;
        Ok(json!(picked.map(|p| p.to_string_lossy().replace('\\', "/"))))
    }
    #[cfg(target_os = "macos")]
    {
        let _ = p;
        bail!("no folder dialog on this system: type the path")
    }
}
