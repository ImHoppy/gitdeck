//! "Switch to this branch" for a PR, plain git: fetch its head, then switch to the branch the plan
//! picks, stashing uncommitted changes only when the user said so.

use crate::{
    pr_branch::{self, ClashChoice, Plan, PrHead},
    state::{self, git_dir},
};
use gitcore::{
    commands::{operation, pull_ref, refs, remote, stash, sync::classify},
    model::Head,
    GitRunner, RunError,
};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchRequest {
    pub pr: PrHead,
    pub remote: String,
    /// Where the fork can be cloned from, when maintainers may push to it.
    #[serde(default)]
    pub fork_url: Option<String>,
    #[serde(default)]
    pub choice: Option<ClashChoice>,
    /// Stash uncommitted changes first (the user agreed).
    #[serde(default)]
    pub stash: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum SwitchOutcome {
    Switched { branch: String, previous: Option<String>, stash: Option<String> },
    Clash { branch: String, separate: String },
    /// Uncommitted changes: nothing was done, the page asks whether to stash them.
    Dirty,
    Skipped { reason: String },
    Failed { message: String },
}

const STASH_MESSAGE: &str = "gitdeck: switched to a pull request";

async fn git<R: GitRunner>(runner: &R, path: &Path, args: &[String]) -> Result<(), String> {
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = runner.run(path, &args).await.map_err(|e| e.to_string())?;
    match out.ok() {
        true => Ok(()),
        false => Err(String::from_utf8_lossy(&out.stderr).trim().lines().last().unwrap_or("git failed").to_string()),
    }
}

fn v(args: &[&str]) -> Vec<String> {
    args.iter().map(|s| s.to_string()).collect()
}

/// The remote for a fork: one already pointing at it, else a new one named after its owner.
async fn fork_remote<R: GitRunner>(runner: &R, path: &Path, slug: &str, url: &str) -> Result<String, String> {
    let wanted = remote::GithubRepo::parse_slug(slug).ok_or("bad fork name")?;
    let out = runner.run_ok(path, remote::LIST_ARGS).await.map_err(|e| e.to_string())?;
    let remotes = remote::parse(&out);
    if let Some(r) = remotes.iter().find(|r| remote::github_repo(&r.fetch_url).is_some_and(|g| g.is(&wanted))) {
        return Ok(r.name.clone());
    }
    let owner = wanted.owner.to_lowercase();
    let name = if remotes.iter().any(|r| r.name == owner) { format!("{owner}-fork") } else { owner };
    git(runner, path, &v(&["remote", "add", &name, url])).await?;
    Ok(name)
}

pub async fn switch<R: GitRunner>(runner: &R, path: &Path, req: &SwitchRequest) -> SwitchOutcome {
    match run(runner, path, req).await {
        Ok(outcome) => outcome,
        Err(message) => SwitchOutcome::Failed { message },
    }
}

async fn run<R: GitRunner>(runner: &R, path: &Path, req: &SwitchRequest) -> Result<SwitchOutcome, String> {
    let dir = git_dir(runner, path).await.map_err(|e| e.to_string())?;
    if let Some(op) = operation::detect(&dir) {
        return Ok(SwitchOutcome::Skipped { reason: format!("{op:?} in progress") });
    }
    let current = state::load(runner, path).await.map_err(|e| e.to_string())?;
    let previous = match &current.head {
        Head::Branch { name } => Some(name.clone()),
        _ => None,
    };
    let pr = &req.pr;
    let head = &pr.head_ref_name;
    let mut fork = None;
    if pr.is_cross_repository {
        git(runner, path, &pull_ref::fetch_args(&req.remote, pr.number)).await?;
        if let (true, Some(slug), Some(url)) = (pr.maintainer_can_modify, &pr.head_repo, &req.fork_url) {
            let name = fork_remote(runner, path, slug, url).await?;
            git(runner, path, &v(&["fetch", "--no-recurse-submodules", &name, &format!("+refs/heads/{head}:refs/remotes/{name}/{head}")])).await?;
            fork = Some(name);
        }
    } else {
        let refspec = format!("+refs/heads/{head}:refs/remotes/{}/{head}", req.remote);
        git(runner, path, &v(&["fetch", "--no-recurse-submodules", &req.remote, &refspec])).await?;
    }
    let out = runner.run_ok(path, refs::ARGS).await.map_err(|e: RunError| e.to_string())?;
    let plan = pr_branch::plan(&refs::parse(&out), &req.remote, pr, fork.as_deref(), req.choice);
    let target = match &plan {
        Plan::Clash { branch, separate } => return Ok(SwitchOutcome::Clash { branch: branch.clone(), separate: separate.clone() }),
        Plan::Existing { branch } | Plan::Create { branch, .. } => branch.clone(),
    };
    if previous.as_deref() == Some(target.as_str()) {
        return Ok(SwitchOutcome::Switched { branch: target, previous: None, stash: None });
    }
    let s = &current.status;
    let dirty = s.staged + s.unstaged + s.conflicts > 0;
    if dirty && !req.stash {
        return Ok(SwitchOutcome::Dirty);
    }
    let stashed = if dirty {
        git(runner, path, &v(&["stash", "push", "-m", STASH_MESSAGE])).await?;
        let sha = runner.run_ok(path, &["rev-parse", "refs/stash"]).await.map_err(|e| e.to_string())?;
        Some(String::from_utf8_lossy(&sha).trim().to_string())
    } else {
        None
    };
    let switched = match &plan {
        Plan::Create { branch, start, upstream: Some(up) } if start == up => git(runner, path, &v(&["switch", "-c", branch, "--track", up])).await,
        Plan::Create { branch, start, upstream } => {
            let made = git(runner, path, &v(&["switch", "--no-track", "-c", branch, start])).await;
            match (made, upstream) {
                (Ok(()), Some(up)) => git(runner, path, &v(&["branch", &format!("--set-upstream-to={up}"), branch])).await,
                (made, _) => made,
            }
        }
        _ => git(runner, path, &v(&["switch", &target])).await,
    };
    if let Err(message) = switched {
        if stashed.is_some() {
            let _ = git(runner, path, &v(&["stash", "pop"])).await;
        }
        return Err(message);
    }
    Ok(SwitchOutcome::Switched { branch: target, previous, stash: stashed })
}

/// Back to the branch the user was on, popping the stash made on the way out. A pop conflict
/// keeps the stash entry, as git does.
pub async fn switch_back<R: GitRunner>(runner: &R, path: &Path, previous: &str, stash_sha: Option<&str>) -> gitcore::commands::sync::SyncOutcome {
    use gitcore::commands::sync::SyncOutcome;
    match git_dir(runner, path).await {
        Ok(dir) if operation::detect(&dir).is_some() => return SyncOutcome::Skipped { reason: "an operation is in progress".into() },
        Err(e) => return SyncOutcome::Failed { message: e.to_string() },
        _ => {}
    }
    if let Err(message) = git(runner, path, &v(&["switch", previous])).await {
        return SyncOutcome::Failed { message };
    }
    let Some(sha) = stash_sha else { return SyncOutcome::Done };
    let list = runner.run_ok(path, stash::LIST_ARGS).await.map(|o| stash::parse(&o)).unwrap_or_default();
    let Some(entry) = list.iter().find(|s| s.sha == sha) else { return SyncOutcome::Done };
    match runner.run(path, &["stash", "pop", &format!("stash@{{{}}}", entry.index)]).await {
        // a clean pop prints the branch status ("up to date"), which isn't the outcome
        Ok(out) if out.ok() => SyncOutcome::Done,
        Ok(out) => classify(out.code, &out.stdout, &out.stderr),
        Err(e) => SyncOutcome::Failed { message: e.to_string() },
    }
}
