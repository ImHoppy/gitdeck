use crate::server::AppState;
use serde::Deserialize;
use serde_json::{json, Value};

pub fn info(app: &AppState) -> anyhow::Result<Value> {
    Ok(json!({ "keepRunning": app.lifecycle.keep_running(), "version": env!("CARGO_PKG_VERSION") }))
}

#[derive(Deserialize)]
pub struct KeepParams {
    on: bool,
}

pub fn keep_running(app: &AppState, p: KeepParams) -> anyhow::Result<Value> {
    app.lifecycle.set_keep_running(p.on);
    info(app)
}

pub fn commands(app: &AppState) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(app.commands.recent())?)
}
