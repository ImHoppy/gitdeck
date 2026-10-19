use crate::{handlers::repo::hub, server::AppState};
use anyhow::bail;
use gitcore::{
    commands::{
        commit,
        diff::{ChangedFile, DiffTarget},
    },
    model::Head,
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use workspace::{changes, state, RepoId};

const DEFAULT_CONTEXT: u32 = 3;

#[derive(Deserialize)]
pub struct FilesParams {
    id: RepoId,
    target: DiffTarget,
}

pub async fn files(app: &AppState, p: FilesParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    Ok(serde_json::to_value(changes::files(&hub.runner, &entry.path, &p.target).await?)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileParams {
    id: RepoId,
    target: DiffTarget,
    file: ChangedFile,
    context: Option<u32>,
}

pub async fn file(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let context = p.context.unwrap_or(DEFAULT_CONTEXT);
    Ok(serde_json::to_value(changes::patch(&hub.runner, &entry.path, &p.target, &p.file, context).await?)?)
}

#[derive(Deserialize)]
pub struct PathsParams {
    id: RepoId,
    paths: Vec<String>,
}

pub async fn stage(app: &AppState, p: PathsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    hub.write_git(p.id, commit::stage_args(&p.paths)).await?;
    Ok(Value::Null)
}

pub async fn unstage(app: &AppState, p: PathsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let unborn = matches!(state::load(&hub.runner, &entry.path).await?.head, Head::Unborn { .. });
    hub.write_git(p.id, commit::unstage_args(&p.paths, unborn)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct CommitParams {
    id: RepoId,
    message: String,
    amend: bool,
}

pub async fn create(app: &AppState, p: CommitParams) -> anyhow::Result<Value> {
    if p.message.trim().is_empty() {
        bail!("empty commit message");
    }
    let hub = hub(app).await?;
    hub.write_git(p.id, commit::commit_args(&p.message, p.amend)).await?;
    Ok(Value::Null)
}

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn last_message(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let out = hub.runner.run_ok(&entry.path, commit::LAST_MESSAGE_ARGS).await?;
    Ok(json!(String::from_utf8_lossy(&out).trim_end()))
}
