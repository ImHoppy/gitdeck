use super::{resolve, write, Target};
use crate::{github::drafts, handlers::repo::hub, server::AppState};
use anyhow::Context;
use gitcore::{
    commands::{
        gh::{pr_create::{self, NewPr}, pr_list::{ListState, Scope}},
        sync::SyncOutcome,
    },
    GhRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Mutex;
use workspace::sync::{self, Action};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateParams {
    #[serde(flatten)]
    target: Target,
    pr: NewPr,
    #[serde(default)]
    draft: Option<String>,
}

/// Pushes the branch (setting its upstream), then opens the PR; answers its number.
pub async fn create(app: &AppState, p: CreateParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let id = r.id.context("create the PR from a workspace repo")?;
    let remote = r.remote.clone().context("no GitHub remote")?;
    let hub = hub(app).await?;
    let path = hub.entry(id)?.path.clone();
    let publish = Action::Publish { remote, branch: p.pr.head.clone() };
    let pushed = hub.gh_write(Some(id), format!("Push {}", p.pr.head), sync::action(&hub.runner, &path, &publish)).await;
    if !matches!(pushed, SyncOutcome::Done | SyncOutcome::UpToDate) {
        return Ok(json!({ "outcome": pushed, "number": null }));
    }
    let (dir, files) = write::attachments(p.draft.as_deref(), &p.pr.body)?;
    let cwd = dir.unwrap_or_else(|| r.cwd.clone());
    let number = Mutex::new(None);
    let job = async {
        let args = pr_create::args(&r.repo, &p.pr, &files);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let result = app.runner.gh(&cwd, &args, Some(p.pr.body.clone().into_bytes())).await;
        if let Ok(out) = &result {
            *number.lock().unwrap_or_else(|e| e.into_inner()) = pr_create::parse_number(&out.stdout);
        }
        write::outcome(result)
    };
    let outcome = hub.gh_write(Some(id), format!("Create PR from {}", p.pr.head), job).await;
    if matches!(outcome, SyncOutcome::Done) {
        if let Some(Ok(dir)) = p.draft.as_deref().map(|d| drafts::dir(&drafts::root(), d)) {
            let _ = tokio::fs::remove_dir_all(dir).await;
        }
        let _ = app.github.list(&app.runner, &r.cwd, &r.repo, ListState::Open, Scope::All, true, None).await;
    }
    let number = *number.lock().unwrap_or_else(|e| e.into_inner());
    Ok(json!({ "outcome": outcome, "number": number }))
}
