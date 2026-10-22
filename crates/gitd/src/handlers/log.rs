use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::{commands::log, GitRunner};
use serde::Deserialize;
use serde_json::{json, Value};
use workspace::RepoId;

#[derive(Deserialize)]
pub struct OpenParams {
    id: RepoId,
    #[serde(default)]
    filter: String,
    /// Search what the diffs add or remove instead of messages.
    #[serde(default)]
    content: bool,
    #[serde(default)]
    options: workspace::history::LogOptions,
}

pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let mut h = hub.histories.current(&hub.runner, p.id, &entry.path, p.options).await?;
    if !p.filter.trim().is_empty() {
        h = hub.histories.filtered(&hub.runner, p.id, &entry.path, p.filter.trim(), p.content).await.context("log not open")?;
    }
    Ok(json!({ "key": h.key.key, "head": h.key.head, "refs": h.key.refs, "count": h.commits.len(), "hasNotes": h.has_notes() }))
}

#[derive(Deserialize)]
pub struct RowsParams {
    id: RepoId,
    key: String,
    start: usize,
    count: usize,
}

const MAX_WINDOW: usize = 2000;

pub async fn rows(app: &AppState, p: RowsParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let h = match p.key.split_once(':') {
        Some((_, view)) => {
            let content = view.starts_with('c');
            hub.histories.filtered(&hub.runner, p.id, &path, view.get(1..).unwrap_or(""), content).await
        }
        None => hub.histories.cached(p.id).await,
    }
    .context("log not open")?;
    if h.key.key != p.key {
        bail!("stale");
    }
    Ok(serde_json::to_value(h.window(p.start, p.count.min(MAX_WINDOW)))?)
}

#[derive(Deserialize)]
pub struct FindParams {
    id: RepoId,
    sha: String,
    #[serde(default)]
    filter: String,
    /// Search what the diffs add or remove instead of messages.
    #[serde(default)]
    content: bool,
}

pub async fn find(app: &AppState, p: FindParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let h = match p.filter.trim() {
        "" => hub.histories.cached(p.id).await,
        q => hub.histories.filtered(&hub.runner, p.id, &path, q, p.content).await,
    }
    .context("log not open")?;
    Ok(json!(h.index_of(&p.sha)))
}

pub async fn ancestors(app: &AppState, p: FindParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let h = match p.filter.trim() {
        "" => hub.histories.cached(p.id).await,
        q => hub.histories.filtered(&hub.runner, p.id, &path, q, p.content).await,
    }
    .context("log not open")?;
    Ok(json!(h.ancestors(&p.sha)))
}

#[derive(Deserialize)]
pub struct BodyParams {
    id: RepoId,
    sha: String,
}

pub async fn body(app: &AppState, p: BodyParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = log::details_args(&p.sha);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = hub.runner.run_ok(&entry.path, &args).await?;
    Ok(serde_json::to_value(log::parse_details(&out).context("unreadable commit")?)?)
}

#[derive(Deserialize)]
pub struct FileHistoryParams {
    id: RepoId,
    path: String,
}

pub async fn file_history(app: &AppState, p: FileHistoryParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = log::file_history_args(&p.path);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = hub.runner.run_ok(&entry.path, &args).await?;
    Ok(serde_json::to_value(log::parse_file_history(&out))?)
}
