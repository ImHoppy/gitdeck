//! The pull request view's GitHub side, opt-in (`github_prs`). Every call goes through the host's
//! own `gh` login, so gitdeck never holds or asks for a token.

pub mod cache;
pub mod http;
pub mod drafts;
pub mod image;

use crate::events::Event;
use anyhow::bail;
use gitcore::{
    commands::{
        gh::{auth::{self, GhAvailability}, pr_list::{self, ListState, PrSummary}},
        remote::{self, GithubRepo},
    },
    GhRunner, GitRunner, ProcessRunner, RunError,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::broadcast;
use workspace::throttle::Throttle;

/// A working login is asked again now and then: it can be revoked on the host.
const READY_TTL: Duration = Duration::from_secs(10 * 60);
/// After `gh auth login` on the host, the view comes alive without a restart.
const NOT_READY_TTL: Duration = Duration::from_secs(20);
const BACKGROUND_GAP: Duration = Duration::from_secs(120);
const MANUAL_GAP: Duration = Duration::from_secs(5);
/// GitHub gives up on a heavy list query (the checks of 100 PRs) now and then; the next try usually works.
const RETRY_AFTER: Duration = Duration::from_secs(2);

fn gateway_timeout(stderr: &str) -> bool {
    stderr.contains("HTTP 502") || stderr.contains("HTTP 504")
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrList {
    pub repo: String,
    pub state: ListState,
    pub prs: Vec<PrSummary>,
    /// Unix seconds of the answer.
    pub at: u64,
    /// How many PRs were asked for; the page asks for more as it scrolls to the end.
    pub limit: u32,
    /// Every PR in this state is in the list (fewer came back than asked for).
    pub complete: bool,
}

pub struct Github {
    enabled: AtomicBool,
    availability: Mutex<Option<(Instant, GhAvailability)>>,
    remotes: Mutex<HashMap<PathBuf, Option<(String, GithubRepo)>>>,
    lists: Mutex<HashMap<(String, ListState), PrList>>,
    throttle: Mutex<Throttle>,
    pub cache: cache::Cache,
    /// Per clone: the branch left by "Switch to this branch" and the stash made then.
    switched: Mutex<HashMap<PathBuf, SwitchedFrom>>,
    events: broadcast::Sender<Event>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchedFrom {
    pub previous: String,
    pub stash: Option<String>,
}

fn lock<T>(m: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|e| e.into_inner())
}

fn key(repo: &GithubRepo) -> String {
    repo.slug().to_lowercase()
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

/// gh's own message, or what to do when it isn't there.
pub fn gh_error(e: RunError) -> anyhow::Error {
    match e {
        RunError::Spawn(e) if e.kind() == std::io::ErrorKind::NotFound => anyhow::anyhow!("gh is not installed on the host"),
        RunError::Failed { stderr, .. } => anyhow::anyhow!("{}", stderr.trim_start_matches("gh: ")),
        e => e.into(),
    }
}

impl Github {
    pub fn new(enabled: bool, events: broadcast::Sender<Event>) -> Self {
        Self {
            enabled: AtomicBool::new(enabled),
            availability: Mutex::new(None),
            remotes: Mutex::default(),
            lists: Mutex::default(),
            throttle: Mutex::new(Throttle::new(BACKGROUND_GAP, MANUAL_GAP)),
            cache: cache::Cache::default(),
            switched: Mutex::default(),
            events,
        }
    }

    pub fn enabled(&self) -> bool {
        self.enabled.load(Ordering::Relaxed)
    }

    pub fn set_enabled(&self, on: bool) {
        self.enabled.store(on, Ordering::Relaxed);
    }

    pub async fn availability(&self, runner: &ProcessRunner, recheck: bool) -> GhAvailability {
        if let Some((at, known)) = lock(&self.availability).clone() {
            let ttl = if matches!(known, GhAvailability::Ready { .. }) { READY_TTL } else { NOT_READY_TTL };
            if !recheck && at.elapsed() < ttl {
                return known;
            }
        }
        let found = match runner.gh(&std::env::temp_dir(), auth::STATUS_ARGS, None).await {
            Ok(out) => auth::parse(&out.stdout),
            Err(RunError::Spawn(e)) if e.kind() == std::io::ErrorKind::NotFound => GhAvailability::Missing,
            Err(e) => GhAvailability::Failed { message: e.to_string() },
        };
        *lock(&self.availability) = Some((Instant::now(), found.clone()));
        found
    }

    /// Refuses unless the feature is on and gh has a login.
    pub async fn ready(&self, runner: &ProcessRunner) -> anyhow::Result<String> {
        if !self.enabled() {
            bail!("pull requests are off (Settings)");
        }
        match self.availability(runner, false).await {
            GhAvailability::Ready { login } => Ok(login),
            GhAvailability::LoggedOut => bail!("gh is not logged in: run `gh auth login` on the host"),
            GhAvailability::Missing => bail!("gh is not installed on the host"),
            GhAvailability::Failed { message } => bail!("{message}"),
        }
    }

    /// The remote and GitHub repo of the clone at `path`, if it has one on GitHub.
    pub async fn remote_of(&self, runner: &ProcessRunner, path: &Path, reload: bool) -> Option<(String, GithubRepo)> {
        if !reload {
            if let Some(known) = lock(&self.remotes).get(path) {
                return known.clone();
            }
        }
        let out = runner.run_ok(path, remote::LIST_ARGS).await.ok()?;
        let found = remote::github_remote(&remote::parse(&out));
        lock(&self.remotes).insert(path.to_path_buf(), found.clone());
        found
    }

    pub fn cached_list(&self, repo: &GithubRepo, state: ListState) -> Option<PrList> {
        lock(&self.lists).get(&(key(repo), state)).cloned()
    }

    /// The cached list while the throttle holds, else a fresh one, pushed to every page when it changed.
    /// `limit` asks for a longer list (the page scrolled to its end); without one the list keeps
    /// the length it has, so a background refresh never shortens what someone scrolled through.
    pub async fn list(&self, runner: &ProcessRunner, cwd: &Path, repo: &GithubRepo, state: ListState, manual: bool, limit: Option<u32>) -> anyhow::Result<PrList> {
        let k = key(repo);
        let cached = self.cached_list(repo, state);
        let known = cached.as_ref().map_or(pr_list::PAGE, |c| c.limit);
        let limit = limit.unwrap_or(known).clamp(pr_list::PAGE, pr_list::MAX_LIMIT).max(known);
        let longer = cached.as_ref().is_some_and(|c| limit > c.limit && !c.complete);
        let allowed = lock(&self.throttle).take(&format!("{k}:{state:?}"), Instant::now(), manual || longer);
        if let (false, Some(cached)) = (allowed, &cached) {
            return Ok(cached.clone());
        }
        let args = pr_list::args(repo, state, limit);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let out = match runner.gh_ok(cwd, &args).await {
            Err(RunError::Failed { stderr, .. }) if gateway_timeout(&stderr) => {
                tokio::time::sleep(RETRY_AFTER).await;
                runner.gh_ok(cwd, &args).await
            }
            out => out,
        }
        .map_err(gh_error)?;
        let prs = pr_list::parse(&out)?;
        let complete = (prs.len() as u32) < limit;
        let list = PrList { repo: repo.slug(), state, prs, at: now_secs(), limit, complete };
        let changed = cached.is_none_or(|c| serde_json::to_value(&c.prs).ok() != serde_json::to_value(&list.prs).ok());
        lock(&self.lists).insert((k, state), list.clone());
        if changed {
            let _ = self.events.send(Event::PullRequests(list.clone()));
        }
        Ok(list)
    }

    pub fn switched_from(&self, path: &Path) -> Option<SwitchedFrom> {
        lock(&self.switched).get(path).cloned()
    }

    pub fn set_switched_from(&self, path: &Path, from: Option<SwitchedFrom>) {
        match from {
            Some(f) => lock(&self.switched).insert(path.to_path_buf(), f),
            None => lock(&self.switched).remove(path),
        };
    }

    pub fn navigate(&self, target: serde_json::Value) {
        let _ = self.events.send(Event::Navigate(target));
    }

    /// After an auto fetch: the open PRs of each fetched repo, quietly, skipping what fails.
    pub fn refresh_after_fetch(self: &Arc<Self>, runner: ProcessRunner, paths: Vec<PathBuf>) {
        if !self.enabled() {
            return;
        }
        let gh = self.clone();
        tokio::spawn(async move {
            if !matches!(gh.availability(&runner, false).await, GhAvailability::Ready { .. }) {
                return;
            }
            let mut seen = std::collections::HashSet::new();
            for path in paths {
                let Some((_, repo)) = gh.remote_of(&runner, &path, false).await else { continue };
                if seen.insert(key(&repo)) {
                    let _ = gh.list(&runner, &path, &repo, ListState::Open, false, None).await;
                }
            }
        });
    }
}
