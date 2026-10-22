use super::{resolve, Resolved, Target};
use crate::{github::drafts, handlers::repo::hub, server::AppState};
use gitcore::{
    commands::{
        gh::{
            graphql::{self, Mutation},
            pr_comment, pr_edit,
            pr_query::Query,
            pr_merge::{self, MergeMethod},
            pr_state::{self, StateChange},
        },
        sync::SyncOutcome,
    },
    GhRunner, GitOutput, GitRunner, RunError,
};
use serde::Deserialize;
use serde_json::Value;
use std::path::PathBuf;

/// What a gh write printed, as the job outcome: its last error line on failure.
pub fn outcome(result: Result<GitOutput, RunError>) -> SyncOutcome {
    match result {
        Ok(out) if out.ok() => SyncOutcome::Done,
        Ok(out) => {
            let err = String::from_utf8_lossy(&out.stderr);
            let line = err.trim().lines().last().unwrap_or("gh failed").trim_start_matches("gh: ");
            SyncOutcome::Failed { message: line.to_string() }
        }
        Err(e) => SyncOutcome::Failed { message: e.to_string() },
    }
}

pub async fn gh(app: &AppState, cwd: &std::path::Path, args: Vec<String>, input: Option<Vec<u8>>) -> SyncOutcome {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    outcome(app.runner.gh(cwd, &args, input).await)
}

/// The draft's pictures the body uses: gh runs in that folder so `./shot.png` resolves.
pub fn attachments(draft: Option<&str>, body: &str) -> anyhow::Result<(Option<PathBuf>, Vec<String>)> {
    let Some(draft) = draft else { return Ok((None, Vec::new())) };
    let dir = drafts::dir(&drafts::root(), draft)?;
    let files = drafts::referenced(&dir, body);
    Ok(if files.is_empty() { (None, files) } else { (Some(dir), files) })
}

async fn finish(app: &AppState, r: &Resolved, outcome: &SyncOutcome, draft: Option<&str>) {
    if matches!(outcome, SyncOutcome::Done) {
        if let Some(Ok(dir)) = draft.map(|d| drafts::dir(&drafts::root(), d)) {
            let _ = tokio::fs::remove_dir_all(dir).await;
        }
        let _ = app.github.list(&app.runner, &r.cwd, &r.repo, &Query::open(), true, None).await;
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommentParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
    body: String,
    #[serde(default)]
    draft: Option<String>,
}

pub async fn comment(app: &AppState, p: CommentParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let (dir, files) = attachments(p.draft.as_deref(), &p.body)?;
    let cwd = dir.unwrap_or_else(|| r.cwd.clone());
    let job = gh(app, &cwd, pr_comment::args(&r.repo, p.number, &files), Some(p.body.into_bytes()));
    let out = hub(app).await?.gh_write(r.id, format!("Comment on #{}", p.number), job).await;
    finish(app, &r, &out, p.draft.as_deref()).await;
    Ok(serde_json::to_value(out)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
    title: String,
    body: String,
    #[serde(default)]
    draft: Option<String>,
}

pub async fn edit(app: &AppState, p: EditParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let (dir, files) = attachments(p.draft.as_deref(), &p.body)?;
    let cwd = dir.unwrap_or_else(|| r.cwd.clone());
    let job = gh(app, &cwd, pr_edit::args(&r.repo, p.number, &p.title, &files), Some(p.body.into_bytes()));
    let out = hub(app).await?.gh_write(r.id, format!("Edit #{}", p.number), job).await;
    finish(app, &r, &out, p.draft.as_deref()).await;
    Ok(serde_json::to_value(out)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MutateParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
    mutation: Mutation,
}

/// Thread replies, edits, deletes, resolving and reviews: GraphQL, the body on stdin.
pub async fn mutate(app: &AppState, p: MutateParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let title = match &p.mutation {
        Mutation::Reply { .. } => "Reply",
        Mutation::Edit { .. } => "Edit comment",
        Mutation::Delete { .. } => "Delete comment",
        Mutation::Resolve { .. } => "Resolve thread",
        Mutation::Unresolve { .. } => "Unresolve thread",
        Mutation::Review { .. } => "Review",
    };
    let job = async {
        let result = app.runner.gh(&r.cwd, graphql::ARGS, Some(p.mutation.request())).await;
        match result {
            // a refused write is a 200 with `errors`, and gh exits 1 printing them
            Ok(out) => match graphql::check(&out.stdout) {
                Ok(()) if out.ok() => SyncOutcome::Done,
                Ok(()) => outcome(Ok(out)),
                Err(message) => SyncOutcome::Failed { message },
            },
            Err(e) => SyncOutcome::Failed { message: e.to_string() },
        }
    };
    let out = hub(app).await?.gh_write(r.id, format!("{title} on #{}", p.number), job).await;
    finish(app, &r, &out, None).await;
    Ok(serde_json::to_value(out)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StateParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
    change: StateChange,
}

pub async fn state(app: &AppState, p: StateParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let job = gh(app, &r.cwd, pr_state::args(&r.repo, p.number, p.change), None);
    let out = hub(app).await?.gh_write(r.id, format!("{:?} #{}", p.change, p.number), job).await;
    finish(app, &r, &out, None).await;
    Ok(serde_json::to_value(out)?)
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MergeParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
    method: MergeMethod,
    head_sha: String,
    /// The PR's branch, deleted on GitHub (same repo only) and here after the merge.
    #[serde(default)]
    delete_branch: Option<String>,
    /// The local branch checked out for the PR, if any.
    #[serde(default)]
    local_branch: Option<String>,
    /// A squash's commit message, as edited in the merge dialog.
    #[serde(default)]
    message: Option<SquashMessage>,
}

#[derive(Deserialize)]
pub struct SquashMessage {
    subject: String,
    body: String,
}

pub async fn merge(app: &AppState, p: MergeParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let hub = hub(app).await?;
    let job = async {
        let merged = match (&p.method, &p.message) {
            (MergeMethod::Squash, Some(m)) => {
                gh(app, &r.cwd, pr_merge::squash_args(&r.repo, p.number, &p.head_sha, &m.subject), Some(m.body.clone().into_bytes())).await
            }
            _ => gh(app, &r.cwd, pr_merge::args(&r.repo, p.number, p.method, &p.head_sha), None).await,
        };
        if !matches!(merged, SyncOutcome::Done) {
            return merged;
        }
        if let Some(branch) = &p.delete_branch {
            let deleted = gh(app, &r.cwd, pr_merge::delete_remote_branch_args(&r.repo, branch), None).await;
            if !matches!(deleted, SyncOutcome::Done) {
                return deleted;
            }
        }
        SyncOutcome::Done
    };
    let mut out = hub.gh_write(r.id, format!("Merge #{}", p.number), job).await;
    if let (SyncOutcome::Done, Some(id), Some(local), Some(_)) = (&out, r.id, &p.local_branch, &p.delete_branch) {
        let path = hub.entry(id)?.path.clone();
        let exists = app.runner.run(&path, &["rev-parse", "--verify", "-q", &format!("refs/heads/{local}")]).await.is_ok_and(|o| o.ok());
        if exists {
            // a checked-out branch stays: git refuses, and the user is still on it
            if let Err(e) = hub.write_git(id, vec!["branch".into(), "-D".into(), local.clone()]).await {
                out = SyncOutcome::Failed { message: format!("merged, but the local branch stays: {e}") };
            }
        }
    }
    finish(app, &r, &out, None).await;
    Ok(serde_json::to_value(out)?)
}

#[derive(Deserialize)]
pub struct DraftParams {
    draft: String,
}

pub async fn discard_draft(_app: &AppState, p: DraftParams) -> anyhow::Result<Value> {
    let _ = tokio::fs::remove_dir_all(drafts::dir(&drafts::root(), &p.draft)?).await;
    Ok(Value::Null)
}
