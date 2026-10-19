use crate::{hub::Hub, server::AppState};
use anyhow::Context;
use serde::Deserialize;
use serde_json::Value;
use std::sync::Arc;
use workspace::{
    sync::{RebaseAction, SyncKind},
    RepoId,
};

pub async fn hub(app: &AppState) -> anyhow::Result<Arc<Hub>> {
    app.live.lock().await.as_ref().map(|l| l.hub.clone()).context("no workspace open")
}

#[derive(Deserialize)]
pub struct SyncParams {
    id: RepoId,
    kind: SyncKind,
}

pub async fn sync(app: &AppState, p: SyncParams) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(hub(app).await?.sync(p.id, p.kind).await)?)
}

#[derive(Deserialize)]
pub struct SyncAllParams {
    kind: SyncKind,
}

pub async fn sync_all(app: &AppState, p: SyncAllParams) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(hub(app).await?.sync_all(p.kind).await)?)
}

#[derive(Deserialize)]
pub struct RebaseParams {
    id: RepoId,
    action: RebaseAction,
}

pub async fn rebase(app: &AppState, p: RebaseParams) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(hub(app).await?.rebase(p.id, p.action).await)?)
}

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn update_submodules(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(hub(app).await?.update_submodules(p.id).await)?)
}
