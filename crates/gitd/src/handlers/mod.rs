mod workspace;

use crate::server::AppState;
use anyhow::anyhow;
use serde_json::Value;

pub async fn dispatch(app: &AppState, method: &str, params: Value) -> anyhow::Result<Value> {
    match method {
        "workspace.list" => workspace::list(app),
        "workspace.open" => workspace::open(app, serde_json::from_value(params)?).await,
        _ => Err(anyhow!("unknown method {method}")),
    }
}
