use crate::{github::SwitchedFrom, handlers::repo::hub, server::AppState};
use gitcore::{
    commands::{remote::{self, GithubRepo}, sync::SyncOutcome},
    GitRunner,
};
use serde::Deserialize;
use serde_json::Value;
use workspace::{
    pr_switch::{self, SwitchOutcome, SwitchRequest},
    RepoId,
};

#[derive(Deserialize)]
pub struct SwitchParams {
    id: RepoId,
    request: SwitchRequest,
}

/// Plain git through the write queue; remembers where the user came from for "Switch back".
pub async fn switch(app: &AppState, p: SwitchParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let mut req = p.request;
    if let Some(fork) = req.pr.head_repo.as_deref().and_then(GithubRepo::parse_slug).filter(|_| req.pr.is_cross_repository) {
        let url = app.runner.run_ok(&path, &["remote", "get-url", &req.remote]).await.unwrap_or_default();
        req.fork_url = Some(remote::github_url(&fork, &String::from_utf8_lossy(&url)));
    }
    let outcome = hub.queued(p.id, pr_switch::switch(&hub.runner, &path, &req)).await;
    if let SwitchOutcome::Switched { previous: Some(previous), stash, .. } = &outcome {
        app.github.set_switched_from(&path, Some(SwitchedFrom { previous: previous.clone(), stash: stash.clone() }));
    }
    Ok(serde_json::to_value(outcome)?)
}

#[derive(Deserialize)]
pub struct RepoParams {
    id: RepoId,
}

pub async fn switch_back(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let Some(from) = app.github.switched_from(&path) else {
        return Ok(serde_json::to_value(SyncOutcome::Skipped { reason: "nothing to switch back to".into() })?);
    };
    let outcome = hub.queued(p.id, pr_switch::switch_back(&hub.runner, &path, &from.previous, from.stash.as_deref())).await;
    if !matches!(outcome, SyncOutcome::Failed { .. } | SyncOutcome::Skipped { .. }) {
        app.github.set_switched_from(&path, None);
    }
    Ok(serde_json::to_value(outcome)?)
}

/// The branch "Switch back" returns to, if the user switched to a PR from here.
pub async fn switched_from(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    Ok(serde_json::to_value(app.github.switched_from(&path))?)
}
