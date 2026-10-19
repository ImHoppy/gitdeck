use crate::{handlers::repo::hub, server::AppState};
use gitcore::{commands::stash, GitRunner};
use serde::Deserialize;
use serde_json::Value;
use workspace::{
    sync::{self, Action},
    RepoId,
};

#[derive(Deserialize)]
pub struct RunParams {
    id: RepoId,
    action: Action,
}

pub async fn run(app: &AppState, p: RunParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let outcome = hub.queued(p.id, sync::action(&hub.runner, &entry.path, &p.action)).await;
    Ok(serde_json::to_value(outcome)?)
}

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn stashes(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let entry = hub.entry(p.id)?;
    let out = hub.runner.run_ok(&entry.path, stash::LIST_ARGS).await?;
    Ok(serde_json::to_value(stash::parse(&out))?)
}
