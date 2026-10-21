use super::{resolve, Target};
use crate::{github::gh_error, handlers::repo::hub, server::AppState};
use anyhow::Context;
use gitcore::{
    commands::{
        gh::{issue, pr_checks, pr_view, repo_view, timeline},
        merge_base, pull_ref,
        remote::GithubRepo,
    },
    GhRunner, GitRunner,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::time::Duration;
use workspace::RepoId;

const REPO_INFO_TTL: Duration = Duration::from_secs(60 * 60);
const CARD_TTL: Duration = Duration::from_secs(10 * 60);

#[derive(Deserialize)]
pub struct PrParams {
    #[serde(flatten)]
    target: Target,
    number: u64,
}

async fn gh_json(app: &AppState, cwd: &std::path::Path, args: Vec<String>) -> anyhow::Result<Vec<u8>> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    app.runner.gh_ok(cwd, &args).await.map_err(gh_error)
}

pub async fn view(app: &AppState, p: PrParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let out = gh_json(app, &r.cwd, pr_view::args(&r.repo, p.number)).await?;
    Ok(serde_json::to_value(pr_view::parse(&out)?)?)
}

pub async fn checks(app: &AppState, p: PrParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let args = pr_checks::args(&r.repo, p.number);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    // pending or failing checks exit non-zero with the JSON printed all the same
    let out = app.runner.gh(&r.cwd, &args, None).await.map_err(gh_error)?;
    if !out.ok() && out.stdout.trim_ascii().is_empty() && !String::from_utf8_lossy(&out.stderr).contains("no checks") {
        anyhow::bail!("{}", String::from_utf8_lossy(&out.stderr).trim());
    }
    Ok(serde_json::to_value(pr_checks::parse(&out.stdout)?)?)
}

pub async fn timeline(app: &AppState, p: PrParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let out = gh_json(app, &r.cwd, timeline::args(&r.repo, p.number)).await?;
    Ok(serde_json::to_value(timeline::parse(&out)?)?)
}

#[derive(Deserialize)]
pub struct RepoParams {
    #[serde(flatten)]
    target: Target,
}

/// Default branch, allowed merge methods and the viewer's permission.
pub async fn repo_info(app: &AppState, p: RepoParams) -> anyhow::Result<Value> {
    let r = resolve(app, &p.target).await?;
    let key = format!("repo:{}", r.repo.slug().to_lowercase());
    if let Some(v) = app.github.cache.get(&key, REPO_INFO_TTL) {
        return Ok(v);
    }
    let out = gh_json(app, &r.cwd, repo_view::args(&r.repo)).await?;
    let v = serde_json::to_value(repo_view::parse(&out)?)?;
    app.github.cache.put(key, v.clone());
    Ok(v)
}

#[derive(Deserialize)]
pub struct CardParams {
    repo: String,
    number: u64,
}

/// What `owner/repo#n` is (PR or issue) with its title and state, for links and hover cards.
pub async fn card(app: &AppState, p: CardParams) -> anyhow::Result<Value> {
    app.github.ready(&app.runner).await?;
    let repo = GithubRepo::parse_slug(&p.repo).context("not a GitHub repo")?;
    let key = format!("card:{}#{}", repo.slug().to_lowercase(), p.number);
    if let Some(v) = app.github.cache.get(&key, CARD_TTL) {
        return Ok(v);
    }
    let out = gh_json(app, &std::env::temp_dir(), issue::card_args(&repo, p.number)).await?;
    let v = serde_json::to_value(issue::parse(&out)?)?;
    app.github.cache.put(key, v.clone());
    Ok(v)
}

#[derive(Deserialize)]
pub struct FetchParams {
    id: RepoId,
    number: u64,
    base: String,
}

/// Plain git, no API: brings `refs/pull/<n>/head` and the base branch in, for the PR's diff
/// (`merge base...head`, what GitHub shows) and its commits in the graph.
pub async fn fetch(app: &AppState, p: FetchParams) -> anyhow::Result<Value> {
    let hub = hub(app).await?;
    let path = hub.entry(p.id)?.path.clone();
    let (remote, _) = app.github.remote_of(&app.runner, &path, false).await.context("this repo has no remote on GitHub")?;
    hub.write_git(p.id, pull_ref::fetch_with_base_args(&remote, p.number, &p.base)).await?;
    let head_ref = pull_ref::local_ref(&remote, p.number);
    let base_ref = format!("refs/remotes/{remote}/{}", p.base);
    let head = app.runner.run_ok(&path, &["rev-parse", &head_ref]).await?;
    let args = merge_base::args(&base_ref, &head_ref);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let base = merge_base::parse(&app.runner.run_ok(&path, &args).await?);
    Ok(json!({ "head": String::from_utf8_lossy(&head).trim(), "mergeBase": base, "remote": remote }))
}
