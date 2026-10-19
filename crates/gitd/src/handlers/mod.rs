pub mod repo;
mod workspace;

use crate::server::AppState;
use anyhow::anyhow;
use serde_json::Value;

pub async fn dispatch(app: &AppState, method: &str, params: Value) -> anyhow::Result<Value> {
    match method {
        "workspace.list" => workspace::list(app),
        "workspace.open" => workspace::open(app, serde_json::from_value(params)?).await,
        "workspace.fetchStale" => workspace::fetch_stale(app, serde_json::from_value(params)?).await,
        "repo.syncAll" => repo::sync_all(app, serde_json::from_value(params)?).await,
        "repo.rebase" => repo::rebase(app, serde_json::from_value(params)?).await,
        "repo.sync" => repo::sync(app, serde_json::from_value(params)?).await,
        _ => Err(anyhow!("unknown method {method}")),
    }
}
