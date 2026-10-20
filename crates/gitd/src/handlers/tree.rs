use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::commands::tracked;
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::Path, process::Command};
use workspace::{tracked::{checkout_args, tracked_branch}, RepoId};

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn checkout_tracked(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?.clone();
    let parent = entry.parent.and_then(|id| hub.entries.get(&id)).map(|e| e.path.clone());
    let branch = tracked_branch(&hub.runner, &entry, parent.as_deref())
        .await?
        .context("no tracked branch: set `branch =` in .gitmodules or fetch origin")?;
    let args = checkout_args(&hub.runner, &entry.path, &branch).await?;
    hub.write_git(p.id, args).await?;
    Ok(json!(branch))
}

#[derive(Deserialize)]
pub struct SubmoduleParams {
    id: RepoId,
    op: String,
}

/// Init or update one submodule; it runs in the superproject, so it goes through that repo's queue.
pub async fn submodule(app: &AppState, p: SubmoduleParams) -> anyhow::Result<Value> {
    if p.op != "init" && p.op != "update" {
        bail!("unknown submodule op {}", p.op);
    }
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let (Some(parent), Some(sub)) = (entry.parent, entry.path_in_parent.clone()) else {
        bail!("{} is not a submodule", entry.name);
    };
    hub.write_git(parent, tracked::submodule_args(&p.op, &sub)).await?;
    hub.publish(p.id).await;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct RevealParams {
    id: RepoId,
    with: String,
    /// A file of the repo to select in the file explorer.
    #[serde(default)]
    path: Option<String>,
}

pub async fn reveal(app: &AppState, p: RevealParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let manager = app.config.lock().unwrap().file_manager.clone();
    match p.with.as_str() {
        "explorer" if manager.is_some() => {
            let target = p.path.as_deref().map(|f| path.join(f)).and_then(|f| f.parent().map(Path::to_path_buf)).unwrap_or(path);
            let manager = manager.unwrap_or_default();
            Command::new(&manager).arg(&target).spawn().with_context(|| format!("could not start `{manager}` (set the file manager in Settings)"))?;
        }
        "explorer" => match &p.path {
            Some(file) => select_in_explorer(&path.join(file))?,
            None => explorer(&path)?,
        },
        "terminal" => terminal(&path)?,
        other => bail!("unknown target {other}"),
    }
    Ok(Value::Null)
}

fn explorer(path: &Path) -> std::io::Result<()> {
    let program = if cfg!(windows) { "explorer" } else { "xdg-open" };
    Command::new(program).arg(path).spawn().map(drop)
}

#[cfg(windows)]
fn select_in_explorer(file: &Path) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    // explorer parses its own command line: `/select,"path"` must reach it unescaped
    Command::new("explorer").raw_arg(format!("/select,\"{}\"", file.display().to_string().replace('/', "\\"))).spawn().map(drop)
}

#[cfg(not(windows))]
fn select_in_explorer(file: &Path) -> std::io::Result<()> {
    explorer(file.parent().unwrap_or(file))
}

fn terminal(path: &Path) -> std::io::Result<()> {
    if cfg!(windows) {
        // wt parses its own arguments (`;`, brackets): give it the folder as its working directory
        Command::new("wt")
            .args(["-d", "."])
            .current_dir(path)
            .spawn()
            .or_else(|_| Command::new("cmd").args(["/c", "start", "cmd"]).current_dir(path).spawn())
            .map(drop)
    } else {
        Command::new("x-terminal-emulator").current_dir(path).spawn().map(drop)
    }
}
