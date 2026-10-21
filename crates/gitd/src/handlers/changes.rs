use crate::{handlers::repo::hub, server::AppState};
use anyhow::bail;
use gitcore::{
    commands::{
        commit, discard, pathspec,
        diff::{ChangedFile, DiffTarget, PatchOptions},
    },
    model::Head,
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::collections::HashSet;
use workspace::{
    changes, stage_lines::{self, LineMode},
    state, RepoId,
};

#[derive(Deserialize)]
pub struct FilesParams {
    id: RepoId,
    target: DiffTarget,
    #[serde(default)]
    content: Option<String>,
}

pub async fn files(app: &AppState, p: FilesParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    Ok(serde_json::to_value(changes::files(&hub.runner, &entry.path, &p.target, p.content.as_deref()).await?)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileParams {
    id: RepoId,
    target: DiffTarget,
    file: ChangedFile,
    #[serde(default)]
    options: PatchOptions,
}

pub async fn file(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    Ok(serde_json::to_value(changes::patch(&hub.runner, &entry.path, &p.target, &p.file, p.options).await?)?)
}

#[derive(Deserialize)]
pub struct PathsParams {
    id: RepoId,
    paths: Vec<String>,
}

pub async fn stage(app: &AppState, p: PathsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    for c in pathspec::chunks(&p.paths) {
        hub.write_git(p.id, commit::stage_args(c)).await?;
    }
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct DiscardParams {
    id: RepoId,
    /// Tracked files whose unstaged edits go.
    #[serde(default)]
    paths: Vec<String>,
    /// Untracked files and folders, deleted.
    #[serde(default)]
    untracked: Vec<String>,
}

pub async fn discard(app: &AppState, p: DiscardParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    for c in pathspec::chunks(&p.paths) {
        hub.write_git(p.id, discard::restore_args(c)).await?;
    }
    for c in pathspec::chunks(&p.untracked) {
        hub.write_git(p.id, discard::clean_args(c)).await?;
    }
    Ok(Value::Null)
}

pub async fn unstage(app: &AppState, p: PathsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let unborn = matches!(state::load(&hub.runner, &entry.path).await?.head, Head::Unborn { .. });
    for c in pathspec::chunks(&p.paths) {
        hub.write_git(p.id, commit::unstage_args(c, unborn)).await?;
    }
    Ok(Value::Null)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LinesParams {
    id: RepoId,
    file: ChangedFile,
    mode: LineMode,
    diff_id: String,
    lines: HashSet<usize>,
}

pub async fn lines(app: &AppState, p: LinesParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let job = stage_lines::apply(&hub.runner, &entry.path, &p.file, p.mode, &p.diff_id, &p.lines);
    hub.queued(p.id, job).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitParams {
    id: RepoId,
    message: String,
    amend: bool,
    /// Adds a `Signed-off-by:` line with your name and email.
    #[serde(default)]
    sign_off: bool,
}

pub async fn create(app: &AppState, p: CommitParams) -> anyhow::Result<Value> {
    if p.message.trim().is_empty() {
        bail!("empty commit message");
    }
    let hub = hub(app).await?;
    hub.write_git(p.id, commit::commit_args(&p.message, p.amend, p.sign_off)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

/// The text of the configured commit template, empty when none is set.
pub async fn template(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let out = hub.runner.run(&entry.path, commit::TEMPLATE_ARGS).await?;
    let path = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if !out.ok() || path.is_empty() {
        return Ok(json!(""));
    }
    let file = std::path::Path::new(&path);
    let file = if file.is_relative() { entry.path.join(file) } else { file.to_path_buf() };
    Ok(json!(std::fs::read_to_string(file).unwrap_or_default()))
}

pub async fn last_message(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let out = hub.runner.run_ok(&entry.path, commit::LAST_MESSAGE_ARGS).await?;
    Ok(json!(String::from_utf8_lossy(&out).trim_end()))
}
