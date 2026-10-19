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
}

pub async fn reveal(app: &AppState, p: RevealParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    match p.with.as_str() {
        "explorer" => explorer(&path)?,
        "terminal" => terminal(&path)?,
        other => bail!("unknown target {other}"),
    }
    Ok(Value::Null)
}

fn explorer(path: &Path) -> std::io::Result<()> {
    let program = if cfg!(windows) { "explorer" } else { "xdg-open" };
    Command::new(program).arg(path).spawn().map(drop)
}

fn terminal(path: &Path) -> std::io::Result<()> {
    if cfg!(windows) {
        Command::new("wt")
            .args(["-d"])
            .arg(path)
            .spawn()
            .or_else(|_| Command::new("cmd").args(["/c", "start", "cmd"]).current_dir(path).spawn())
            .map(drop)
    } else {
        Command::new("x-terminal-emulator").current_dir(path).spawn().map(drop)
    }
}
