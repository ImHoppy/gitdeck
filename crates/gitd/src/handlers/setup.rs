use super::meta;
use crate::{autostart, explorer, server::AppState};
use serde::Deserialize;
use serde_json::Value;
use workspace::config::UpdateMode;

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

#[derive(Deserialize)]
pub struct UpdatesParams {
    mode: UpdateMode,
}

pub async fn set_updates(app: &AppState, p: UpdatesParams) -> anyhow::Result<Value> {
    {
        let mut config = app.config.lock().unwrap();
        config.updates = p.mode;
        config.save(&app.config_path)?;
    }
    meta::info(app).await
}

/// Checks GitHub now, whatever `updates` says; installs only when it says `auto`.
pub async fn check_update(app: &AppState) -> anyhow::Result<Value> {
    let install = app.config.lock().unwrap().updates == UpdateMode::Auto;
    Ok(serde_json::to_value(app.updater.run(install).await)?)
}

pub async fn install_update(app: &AppState) -> anyhow::Result<Value> {
    Ok(serde_json::to_value(app.updater.run(true).await)?)
}

/// Never in the middle of a git job: the new gitd starts with nothing running.
pub async fn restart(app: &AppState) -> anyhow::Result<Value> {
    if app.busy() {
        anyhow::bail!("a git job is running: restart once it is done");
    }
    app.updater.restart()?;
    Ok(Value::Null)
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
