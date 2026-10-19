use crate::{handlers::repo::hub, server::AppState};
use anyhow::bail;
use gitcore::{
    commands::{blame, tree},
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use workspace::RepoId;

const MAX_SHOWN: usize = 4 * 1024 * 1024;

#[derive(Deserialize)]
pub struct DirParams {
    id: RepoId,
    sha: String,
    #[serde(default)]
    dir: String,
}

pub async fn list(app: &AppState, p: DirParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = tree::ls_args(&p.sha, &p.dir);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(serde_json::to_value(tree::parse_ls(&hub.runner.run_ok(&entry.path, &args).await?))?)
}

#[derive(Deserialize)]
pub struct FileParams {
    id: RepoId,
    sha: String,
    path: String,
}

pub async fn show(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = tree::show_args(&p.sha, &p.path);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = hub.runner.run_ok(&entry.path, &args).await?;
    if out.len() > MAX_SHOWN {
        bail!("file too large to show ({} bytes)", out.len());
    }
    if out.iter().take(8000).any(|&b| b == 0) {
        return Ok(json!({ "binary": true, "text": "" }));
    }
    Ok(json!({ "binary": false, "text": String::from_utf8_lossy(&out) }))
}

pub async fn blame(app: &AppState, p: FileParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let args = blame::args(&p.sha, &p.path);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    Ok(serde_json::to_value(blame::parse(&hub.runner.run_ok(&entry.path, &args).await?))?)
}
