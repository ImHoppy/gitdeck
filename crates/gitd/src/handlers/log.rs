use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::{commands::log, GitRunner};
use serde::Deserialize;
use serde_json::{json, Value};
use workspace::RepoId;

#[derive(Deserialize)]
pub struct OpenParams {
    id: RepoId,
}

pub async fn open(app: &AppState, p: OpenParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let h = hub.histories.current(&hub.runner, p.id, &entry.path).await?;
    Ok(json!({ "key": h.key.key, "head": h.key.head, "refs": h.key.refs, "count": h.commits.len() }))
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
    let h = hub.histories.cached(p.id).await.context("log not open")?;
    if h.key.key != p.key {
        bail!("stale");
    }
    Ok(serde_json::to_value(h.window(p.start, p.count.min(MAX_WINDOW)))?)
}

#[derive(Deserialize)]
pub struct FindParams {
    id: RepoId,
    sha: String,
}

pub async fn find(app: &AppState, p: FindParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let h = hub.histories.cached(p.id).await.context("log not open")?;
    Ok(json!(h.index_of(&p.sha)))
}

#[derive(Deserialize)]
pub struct BodyParams {
    id: RepoId,
    sha: String,
}

pub async fn body(app: &AppState, p: BodyParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = log::body_args(&p.sha);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = hub.runner.run_ok(&entry.path, &args).await?;
    Ok(json!(String::from_utf8_lossy(&out).trim_end()))
}
