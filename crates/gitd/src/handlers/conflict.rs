use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::{
    commands::conflicts::{self, Side},
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::Path, process::Command};
use workspace::RepoId;

#[derive(Deserialize)]
pub struct ListParams {
    id: RepoId,
}

pub async fn list(app: &AppState, p: ListParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let out = hub.runner.run_ok(&path, conflicts::STATUS_ARGS).await?;
    Ok(serde_json::to_value(conflicts::parse_status(&out))?)
}

#[derive(Deserialize)]
pub struct TakeParams {
    id: RepoId,
    path: String,
    side: Side,
}

/// Keeps one side of a conflicted file whole and stages it.
pub async fn take(app: &AppState, p: TakeParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    let out = hub.runner.run_ok(&dir, conflicts::STATUS_ARGS).await?;
    let conflict = conflicts::parse_status(&out).into_iter().find(|c| c.path == p.path).with_context(|| format!("{} is not conflicted", p.path))?;
    for args in conflicts::take_args(&conflict, p.side) {
        hub.write_git(p.id, args).await?;
    }
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct FileParams {
    id: RepoId,
    path: String,
}

/// The file is resolved as it now is in the worktree (edited by hand or in the editor).
pub async fn resolved(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    let text = std::fs::read(dir.join(&p.path)).unwrap_or_default();
    if text.windows(8).any(|w| w == b"<<<<<<< ") && text.windows(8).any(|w| w == b">>>>>>> ") {
        bail!("{} still has conflict markers (<<<<<<< … >>>>>>>)", p.path);
    }
    hub.write_git(p.id, conflicts::mark_resolved_args(&p.path)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct EditorParams {
    id: RepoId,
    /// A file of the repo to show; none opens the repo folder.
    #[serde(default)]
    path: Option<String>,
}

pub async fn open_in_editor(app: &AppState, p: EditorParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    let editor = app.config.lock().unwrap().editor.clone().unwrap_or_else(|| DEFAULT_EDITOR.into());
    launch(&editor, &dir, p.path.as_deref()).with_context(|| format!("could not start the editor `{editor}` (set it in Settings)"))?;
    Ok(json!(editor))
}

pub const DEFAULT_EDITOR: &str = "code";

/// VS Code and its forks open the repo as a folder with `-g <file>`, showing their conflict
/// actions and merge editor; any other editor just gets the file.
fn launch(editor: &str, repo: &Path, file: Option<&str>) -> std::io::Result<()> {
    let stem = Path::new(editor).file_stem().map(|s| s.to_string_lossy().to_lowercase()).unwrap_or_default();
    let vscode_like = ["code", "code-insiders", "codium", "vscodium", "cursor", "windsurf"].contains(&stem.as_str());
    let mut args: Vec<String> = Vec::new();
    match (file, vscode_like) {
        (Some(f), true) => args.extend([repo.display().to_string(), "-g".into(), repo.join(f).display().to_string()]),
        (Some(f), false) => args.push(repo.join(f).display().to_string()),
        (None, _) => args.push(repo.display().to_string()),
    }
    let mut cmd = if cfg!(windows) && !editor.to_lowercase().ends_with(".exe") {
        // `code` on PATH is code.cmd, which only cmd can start
        let mut c = Command::new("cmd");
        c.arg("/c").arg(editor);
        c
    } else {
        Command::new(editor)
    };
    cmd.args(&args).current_dir(repo);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.spawn().map(drop)
}
