use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::{
    commands::{bisect, patch, reflog, remote, worktree},
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::{path::PathBuf, process::Command};
use workspace::RepoId;

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn remotes(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    Ok(serde_json::to_value(remote::parse(&hub.runner.run_ok(&path, remote::LIST_ARGS).await?))?)
}

pub async fn reflog(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let args = reflog::args();
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    // a repo without commits has no reflog yet: an empty list, not an error
    let out = hub.runner.run(&path, &args).await?;
    Ok(serde_json::to_value(if out.ok() { reflog::parse(&out.stdout) } else { Vec::new() })?)
}

#[derive(Deserialize)]
pub struct IgnoreParams {
    id: RepoId,
    pattern: String,
    /// `.git/info/exclude` (this clone only) instead of the shared `.gitignore`.
    #[serde(default)]
    exclude: bool,
}

/// Appends a pattern to the repository's top `.gitignore` or its `.git/info/exclude`, creating it when missing.
pub async fn ignore(app: &AppState, p: IgnoreParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    let file = if p.exclude {
        let out = hub.runner.run_ok(&dir, &["rev-parse", "--git-path", "info/exclude"]).await?;
        let file = dir.join(String::from_utf8_lossy(&out).trim());
        if let Some(parent) = file.parent() {
            std::fs::create_dir_all(parent)?;
        }
        file
    } else {
        dir.join(".gitignore")
    };
    let pattern = p.pattern.trim();
    if pattern.is_empty() || pattern.contains('\n') {
        bail!("one pattern, on one line");
    }
    let mut text = std::fs::read_to_string(&file).unwrap_or_default();
    if text.lines().any(|l| l.trim() == pattern) {
        return Ok(Value::Null);
    }
    if !text.is_empty() && !text.ends_with('\n') {
        text.push('\n');
    }
    text.push_str(pattern);
    text.push('\n');
    std::fs::write(&file, text)?;
    hub.publish(p.id).await;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct ToolParams {
    id: RepoId,
    path: String,
    /// `<base>` and `<rev>` of a commit diff; none: the working tree against the index.
    #[serde(default)]
    base: Option<String>,
    #[serde(default)]
    rev: Option<String>,
    #[serde(default)]
    staged: bool,
    /// The editor's diff view even when a diff tool is configured.
    #[serde(default)]
    editor: bool,
}

/// `git difftool` with the configured tool, left running on its own; with no tool configured
/// (git would fail silently) the editor's diff view when it is VS Code-like.
pub async fn difftool(app: &AppState, p: ToolParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    let mut args: Vec<String> = vec!["difftool".into(), "--no-prompt".into()];
    let configured = ["diff.tool", "merge.tool"].iter().any(|k| git_config(app, &dir, k).is_some_and(|v| !v.is_empty()));
    if p.editor || !configured {
        let editor = app.config.lock().unwrap().editor.clone().unwrap_or_else(|| super::conflict::DEFAULT_EDITOR.into());
        if !super::conflict::is_vscode_like(&editor) {
            bail!("no diff tool configured: set diff.tool in the git settings");
        }
        args.push(format!("--extcmd=\"{editor}\" --wait --diff"));
    }
    if p.staged {
        args.push("--cached".into());
    }
    match (&p.base, &p.rev) {
        (Some(b), Some(r)) => args.extend([b.clone(), r.clone()]),
        (None, Some(r)) => args.extend([format!("{r}^!")]),
        _ => {}
    }
    args.extend(["--".into(), p.path.clone()]);
    spawn_git(app, &dir, &args).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct FileParams {
    id: RepoId,
    path: String,
}

/// `git mergetool` on one conflicted file; the watcher picks up the result when the tool closes.
pub async fn mergetool(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let dir = hub.entry(p.id)?.path.clone();
    spawn_git(app, &dir, &["mergetool".into(), "--no-prompt".into(), "--".into(), p.path]).await?;
    Ok(Value::Null)
}

async fn spawn_git(app: &AppState, dir: &std::path::Path, args: &[String]) -> anyhow::Result<()> {
    let mut cmd = Command::new(app.runner.git());
    cmd.args(args).current_dir(dir).env("GIT_TERMINAL_PROMPT", "0");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000);
    }
    cmd.stderr(std::process::Stdio::piped());
    let mut child = cmd.spawn().context("could not start git")?;
    // a tool that fails to start makes git exit at once: show why instead of doing nothing
    tokio::time::sleep(std::time::Duration::from_millis(800)).await;
    if let Some(status) = child.try_wait()? {
        if !status.success() {
            let mut err = String::new();
            if let Some(mut e) = child.stderr.take() {
                use std::io::Read;
                let _ = e.read_to_string(&mut err);
            }
            bail!("{}", err.trim().lines().last().unwrap_or("the tool exited with an error"));
        }
    }
    Ok(())
}

fn git_config(app: &AppState, dir: &std::path::Path, key: &str) -> Option<String> {
    let out = Command::new(app.runner.git()).args(["config", "--get", key]).current_dir(dir).output().ok()?;
    Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

#[derive(Deserialize)]
pub struct PatchParams {
    id: RepoId,
    shas: Vec<String>,
    dir: PathBuf,
}

pub async fn save_patches(app: &AppState, p: PatchParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let args = patch::format_args(&p.shas, &p.dir.to_string_lossy());
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(json!(patch::written(&hub.runner.run_ok(&path, &args).await?)))
}

#[derive(Deserialize)]
pub struct ApplyParams {
    id: RepoId,
    files: Vec<String>,
}

pub async fn apply_patches(app: &AppState, p: ApplyParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let args = patch::am_args(&p.files);
    let outcome = hub.queued(p.id, workspace::sync::raw(&hub.runner, &path, &args)).await;
    hub.publish(p.id).await;
    Ok(serde_json::to_value(outcome)?)
}

#[derive(Deserialize)]
pub struct ArchiveParams {
    id: RepoId,
    rev: String,
    file: PathBuf,
}

pub async fn archive(app: &AppState, p: ArchiveParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let args = patch::archive_args(&p.rev, &p.file.to_string_lossy());
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    hub.runner.run_ok(&path, &args).await?;
    Ok(Value::Null)
}

pub async fn worktrees(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    Ok(serde_json::to_value(worktree::parse(&hub.runner.run_ok(&path, worktree::LIST_ARGS).await?))?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AddWorktreeParams {
    id: RepoId,
    path: String,
    branch: String,
    new_branch: bool,
}

pub async fn add_worktree(app: &AppState, p: AddWorktreeParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    hub.write_git(p.id, worktree::add_args(&p.path, &p.branch, p.new_branch)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct RemoveWorktreeParams {
    id: RepoId,
    path: String,
    #[serde(default)]
    force: bool,
}

pub async fn remove_worktree(app: &AppState, p: RemoveWorktreeParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    hub.write_git(p.id, worktree::remove_args(&p.path, p.force)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct BisectParams {
    id: RepoId,
    /// None stops the bisect and returns to where it started.
    #[serde(default)]
    mark: Option<bisect::Mark>,
    #[serde(default)]
    sha: Option<String>,
}

/// Marks a commit, starting the bisect first when none runs; answers with git's progress line.
pub async fn bisect(app: &AppState, p: BisectParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let Some(mark) = p.mark else {
        hub.write_git(p.id, bisect::reset_args()).await?;
        return Ok(json!("Bisect stopped"));
    };
    let gitdir = PathBuf::from(String::from_utf8_lossy(&hub.runner.run_ok(&path, &["rev-parse", "--absolute-git-dir"]).await?).trim());
    if !gitdir.join("BISECT_LOG").exists() {
        hub.write_git(p.id, bisect::start_args()).await?;
    }
    let out = hub.write_git(p.id, bisect::mark_args(mark, p.sha.as_deref().unwrap_or("HEAD"))).await?;
    Ok(json!(bisect::summary(&out.stdout).unwrap_or_else(|| "Marked; mark one good and one bad commit to start narrowing".into())))
}

#[derive(Deserialize)]
#[cfg_attr(target_os = "macos", allow(dead_code))]
pub struct PickFileParams {
    #[serde(default)]
    title: Option<String>,
    /// Save dialog with this file name; none: open dialog for existing files.
    #[serde(default)]
    save_as: Option<String>,
    #[serde(default)]
    extension: Option<String>,
}

/// The native open/save file dialog on the machine gitd runs on; null when cancelled.
#[cfg_attr(target_os = "macos", allow(unused_variables))]
pub async fn pick_file(p: PickFileParams) -> anyhow::Result<Value> {
    #[cfg(not(target_os = "macos"))]
    {
        let picked = tokio::task::spawn_blocking(move || {
            let mut d = rfd::FileDialog::new().set_title(p.title.unwrap_or_else(|| "Choose a file".into()));
            if let Some(ext) = &p.extension {
                d = d.add_filter(ext.as_str(), &[ext.as_str()]);
            }
            match p.save_as {
                Some(name) => d.set_file_name(name).save_file().map(|f| vec![f]),
                None => d.pick_files(),
            }
        })
        .await?;
        Ok(json!(picked.map(|fs| fs.iter().map(|f| f.to_string_lossy().replace('\\', "/")).collect::<Vec<_>>())))
    }
    #[cfg(target_os = "macos")]
    bail!("no file dialog on this system")
}
