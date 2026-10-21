//! `pr.*`: the pull request view. Reads go straight to gh; writes are jobs on the repo's queue.

pub mod create;
pub mod detail;
pub mod switch;
pub mod write;

use crate::{handlers::repo::hub, server::AppState};
use anyhow::Context;
use futures::future::join_all;
use gitcore::{
    commands::{
        gh::pr_list::ListState,
        remote::{self, GithubRepo},
    },
    GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use workspace::RepoId;

/// Which repo a call is about: a workspace repo (its GitHub remote), or `owner/name` for a PR
/// outside the workspace, or both when a workspace repo's other remote is meant.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Target {
    #[serde(default)]
    id: Option<RepoId>,
    #[serde(default)]
    repo: Option<String>,
}

pub struct Resolved {
    pub id: Option<RepoId>,
    pub cwd: PathBuf,
    pub repo: GithubRepo,
    /// The workspace clone's remote for this GitHub repo.
    pub remote: Option<String>,
}

pub async fn resolve(app: &AppState, t: &Target) -> anyhow::Result<Resolved> {
    app.github.ready(&app.runner).await?;
    let explicit = t.repo.as_deref().map(|s| GithubRepo::parse_slug(s).with_context(|| format!("not a GitHub repo: {s}"))).transpose()?;
    let Some(id) = t.id else {
        let repo = explicit.context("no repo given")?;
        return Ok(Resolved { id: None, cwd: std::env::temp_dir(), repo, remote: None });
    };
    let hub = hub(app).await?;
    let path = hub.entry(id)?.path.clone();
    let found = app.github.remote_of(&app.runner, &path, false).await;
    match (explicit, found) {
        (Some(repo), Some((remote, own))) if own.is(&repo) => Ok(Resolved { id: Some(id), cwd: path, repo, remote: Some(remote) }),
        (Some(repo), _) => Ok(Resolved { id: None, cwd: std::env::temp_dir(), repo, remote: None }),
        (None, Some((remote, repo))) => Ok(Resolved { id: Some(id), cwd: path, repo, remote: Some(remote) }),
        (None, None) => anyhow::bail!("this repo has no remote on GitHub"),
    }
}

#[derive(Deserialize)]
pub struct StatusParams {
    #[serde(default)]
    recheck: bool,
}

pub async fn status(app: &AppState, p: StatusParams) -> anyhow::Result<Value> {
    let gh = if app.github.enabled() { Some(app.github.availability(&app.runner, p.recheck).await) } else { None };
    Ok(json!({ "enabled": app.github.enabled(), "gh": gh }))
}

/// The workspace repos with a GitHub remote, for the repo selector.
pub async fn repos(app: &AppState, p: StatusParams) -> anyhow::Result<Value> {
    if !app.github.enabled() {
        return Ok(json!([]));
    }
    let hub = hub(app).await?;
    let entries: Vec<_> = hub.active().cloned().collect();
    let found = join_all(entries.iter().map(|e| app.github.remote_of(&app.runner, &e.path, p.recheck))).await;
    let mut out: Vec<(RepoId, Value)> = entries
        .iter()
        .zip(found)
        .filter_map(|(e, f)| f.map(|(remote, repo)| (e.id, json!({ "id": e.id, "remote": remote, "repo": repo.slug() }))))
        .collect();
    out.sort_by_key(|(id, _)| *id);
    Ok(Value::Array(out.into_iter().map(|(_, v)| v).collect()))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListParams {
    #[serde(flatten)]
    target: Target,
    state: ListState,
    /// The user asked: only a short throttle applies.
    #[serde(default)]
    refresh: bool,
    /// More PRs than the list has: the page scrolled to its end.
    #[serde(default)]
    limit: Option<u32>,
}

pub async fn list(app: &AppState, p: ListParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    Ok(serde_json::to_value(app.github.list(&app.runner, &r.cwd, &r.repo, p.state, p.refresh, p.limit).await?)?)
}

#[derive(Deserialize)]
pub struct FindParams {
    repo: String,
}

/// The workspace clones of `owner/name`, by any remote (origin first), submodules included.
pub async fn find_repo(app: &AppState, p: FindParams) -> anyhow::Result<Value> {
    let wanted = GithubRepo::parse_slug(&p.repo).context("not a GitHub repo")?;
    let hub = hub(app).await?;
    let entries: Vec<_> = hub.active().cloned().collect();
    let remotes = join_all(entries.iter().map(|e| async {
        let out = app.runner.run_ok(&e.path, remote::LIST_ARGS).await.unwrap_or_default();
        remote::parse(&out)
    }))
    .await;
    let mut found: Vec<Value> = Vec::new();
    for (e, remotes) in entries.iter().zip(remotes) {
        let matching = remotes.iter().filter(|r| remote::github_repo(&r.fetch_url).is_some_and(|g| g.is(&wanted)));
        let mut names: Vec<&str> = matching.map(|r| r.name.as_str()).collect();
        names.sort_by_key(|n| *n != "origin");
        if let Some(first) = names.first() {
            found.push(json!({ "id": e.id, "name": e.path_in_parent.as_deref().unwrap_or(&e.name), "remote": first, "origin": *first == "origin" }));
        }
    }
    Ok(Value::Array(found))
}

#[derive(Deserialize)]
pub struct NavigateParams {
    target: Value,
}

/// A PR window asks the main window to show a commit or branch; every page hears it.
pub fn navigate(app: &AppState, p: NavigateParams) -> anyhow::Result<Value> {
    app.github.navigate(p.target);
    Ok(Value::Null)
}
