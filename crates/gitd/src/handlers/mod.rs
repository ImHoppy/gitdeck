mod changes;
mod log;
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
        "repo.updateSubmodules" => repo::update_submodules(app, serde_json::from_value(params)?).await,
        "repo.conflicts" => repo::conflicts(app, serde_json::from_value(params)?).await,
        "repo.rebase" => repo::rebase(app, serde_json::from_value(params)?).await,
        "log.open" => log::open(app, serde_json::from_value(params)?).await,
        "log.rows" => log::rows(app, serde_json::from_value(params)?).await,
        "log.find" => log::find(app, serde_json::from_value(params)?).await,
        "commit.body" => log::body(app, serde_json::from_value(params)?).await,
        "diff.files" => changes::files(app, serde_json::from_value(params)?).await,
        "diff.file" => changes::file(app, serde_json::from_value(params)?).await,
        "stage.files" => changes::stage(app, serde_json::from_value(params)?).await,
        "unstage.files" => changes::unstage(app, serde_json::from_value(params)?).await,
        "commit.create" => changes::create(app, serde_json::from_value(params)?).await,
        "commit.lastMessage" => changes::last_message(app, serde_json::from_value(params)?).await,
        "repo.sync" => repo::sync(app, serde_json::from_value(params)?).await,
        _ => Err(anyhow!("unknown method {method}")),
    }
}
