use super::meta;
use crate::{autostart, explorer, server::AppState};
use serde::Deserialize;
use serde_json::Value;

#[derive(Deserialize)]
pub struct OnParams {
    on: bool,
}

pub async fn set_explorer_menu(app: &AppState, p: OnParams) -> anyhow::Result<Value> {
    tokio::task::spawn_blocking(move || explorer::set(p.on)).await??;
    meta::info(app).await
}

pub async fn set_autostart(app: &AppState, p: OnParams) -> anyhow::Result<Value> {
    tokio::task::spawn_blocking(move || autostart::set(p.on)).await??;
    meta::info(app).await
}

pub async fn set_auto_update(app: &AppState, p: OnParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.auto_update = p.on;
        config.save(&app.config_path)?;
    }
    meta::info(app).await
}

/// Finished or skipped: the setup popup does not come back by itself.
pub async fn finish(app: &AppState) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.setup_done = true;
        config.save(&app.config_path)?;
    }
    meta::info(app).await
}
