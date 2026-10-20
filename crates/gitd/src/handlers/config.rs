use crate::{handlers::repo::hub, server::AppState};
use anyhow::{bail, Context};
use gitcore::{
    commands::config::{self, Scope},
    GitRunner,
};
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;
use workspace::RepoId;

/// Git settings can only be edited through this short list: the page shows exactly these.
const EDITABLE: &[&str] = &[
    "user.name",
    "user.email",
    "core.autocrlf",
    "core.editor",
    "push.autoSetupRemote",
    "fetch.prune",
    "commit.gpgsign",
    "diff.tool",
    "merge.tool",
    "init.defaultBranch",
];

#[derive(Deserialize)]
pub struct ScopeParams {
    /// The repo whose local config to use (and run in); none: global only.
    #[serde(default)]
    id: Option<RepoId>,
    scope: Scope,
}

async fn dir(app: &AppState, id: Option<RepoId>, scope: Scope) -> anyhow::Result<PathBuf> {
    match id {
        Some(id) => Ok(hub(app).await?.entry(id)?.path.clone()),
        None if scope == Scope::Global => Ok(crate::cli::config_dir()),
        None => bail!("pick a repository for its own settings"),
    }
}

pub async fn get(app: &AppState, p: ScopeParams) -> anyhow::Result<Value> {
    let cwd = dir(app, p.id, p.scope).await?;
    std::fs::create_dir_all(&cwd).ok();
    let out = app.runner.run(&cwd, &config::list_args(p.scope).iter().map(String::as_str).collect::<Vec<_>>()).await?;
    // a global config file that doesn't exist yet lists nothing and exits 1
    let all = if out.ok() { config::parse_list(&out.stdout) } else { Default::default() };
    let shown: serde_json::Map<String, Value> = all.into_iter().filter(|(k, _)| EDITABLE.contains(&k.as_str())).map(|(k, v)| (k, Value::String(v))).collect();
    Ok(Value::Object(shown))
}

#[derive(Deserialize)]
pub struct SetParams {
    #[serde(default)]
    id: Option<RepoId>,
    scope: Scope,
    key: String,
    value: String,
}

pub async fn set(app: &AppState, p: SetParams) -> anyhow::Result<Value> {
    if !EDITABLE.contains(&p.key.as_str()) {
        bail!("{} can't be changed here", p.key);
    }
    let cwd = dir(app, p.id, p.scope).await?;
    let args = config::set_args(p.scope, &p.key, p.value.trim());
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = match p.id {
        // a repo's config goes through its write queue like any other write
        Some(id) => {
            let hub = hub(app).await?;
            hub.queued(id, app.runner.run(&cwd, &args)).await?
        }
        None => app.runner.run(&cwd, &args).await?,
    };
    if !out.ok() && !config::unset_missing(out.code) {
        bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }
    get(app, ScopeParams { id: p.id, scope: p.scope }).await.context("reading the config back")
}
