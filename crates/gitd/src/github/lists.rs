//! PR lists, page by page from GitHub's cursor. The first chunk is small so rows show within a
//! second; each chunk is pushed to the pages as it lands. Only one fetch per list runs at a time.

use super::{gh_error, key, lock, now_secs, Github};
use crate::events::Event;
use gitcore::{
    commands::{
        gh::pr_list::{self, ListState, PrSummary, Scope},
        remote::GithubRepo,
    },
    GhRunner, ProcessRunner, RunError,
};
use serde::Serialize;
use std::{
    collections::HashSet,
    path::Path,
    time::{Duration, Instant},
};

/// What a page shows first: a screenful, back from GitHub in about a second even on busy repos.
const FIRST_CHUNK: u32 = 25;
/// Every later request; GitHub's own cap for one page.
const CHUNK: u32 = 100;
/// GitHub gives up on a heavy query now and then; the next try usually works.
const RETRY_AFTER: Duration = Duration::from_secs(2);

/// One list: a repo's PRs in one state, all of them or only the gh login's.
pub type ListKey = (String, ListState, Scope);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrList {
    pub repo: String,
    pub state: ListState,
    pub scope: Scope,
    pub prs: Vec<PrSummary>,
    /// Unix seconds of the answer.
    pub at: u64,
    /// How many PRs were asked for; paging further asks for more.
    pub limit: u32,
    /// Every PR in this state is in the list.
    pub complete: bool,
    /// Where GitHub's next page starts.
    #[serde(skip)]
    pub cursor: Option<String>,
}

fn gateway_timeout(stderr: &str) -> bool {
    stderr.contains("HTTP 502") || stderr.contains("HTTP 504")
}

impl Github {
    pub fn cached_list(&self, repo: &GithubRepo, state: ListState, scope: Scope) -> Option<PrList> {
        lock(&self.lists).get(&(key(repo), state, scope)).cloned()
    }

    /// The cached list while the throttle holds, else a fresh one. `limit` asks for a longer list
    /// (the next page); without one the list keeps its length, so a background refresh never
    /// shortens what someone paged through.
    pub async fn list(
        &self,
        runner: &ProcessRunner,
        cwd: &Path,
        repo: &GithubRepo,
        state: ListState,
        scope: Scope,
        manual: bool,
        limit: Option<u32>,
    ) -> anyhow::Result<PrList> {
        let k: ListKey = (key(repo), state, scope);
        let gate = lock(&self.gates).entry(k.clone()).or_default().clone();
        let _turn = gate.lock().await;
        let cached = self.cached_list(repo, state, scope);
        let known = cached.as_ref().map_or(pr_list::PAGE, |c| c.limit);
        let limit = limit.unwrap_or(known).clamp(pr_list::PAGE, pr_list::MAX_LIMIT).max(known);
        if let Some(c) = &cached {
            if (c.prs.len() as u32) < limit && !c.complete {
                // the next page continues from the cursor: what is shown stays, rows only add
                let mut longer = c.clone();
                longer.limit = limit;
                return self.fill(runner, cwd, repo, longer, true).await;
            }
        }
        let allowed = lock(&self.throttle).take(&format!("{}:{state:?}:{scope:?}", k.0), Instant::now(), manual);
        if let (false, Some(c)) = (allowed, &cached) {
            return Ok(c.clone());
        }
        let fresh = PrList { repo: repo.slug(), state, scope, prs: Vec::new(), at: now_secs(), limit, complete: false, cursor: None };
        // a first load shows each chunk as it lands; a refresh replaces the list in one go
        let list = self.fill(runner, cwd, repo, fresh, cached.is_none()).await?;
        if cached.is_some_and(|c| c.prs != list.prs) {
            let _ = self.events.send(Event::PullRequests(list.clone()));
        }
        lock(&self.lists).insert(k, list.clone());
        Ok(list)
    }

    /// Fetches chunks until the list reaches its limit or GitHub's end; `progressive` pushes each.
    async fn fill(&self, runner: &ProcessRunner, cwd: &Path, repo: &GithubRepo, mut list: PrList, progressive: bool) -> anyhow::Result<PrList> {
        let k: ListKey = (key(repo), list.state, list.scope);
        let mut seen: HashSet<u64> = list.prs.iter().map(|p| p.number).collect();
        while !list.complete && (list.prs.len() as u32) < list.limit {
            let have = list.prs.len() as u32;
            // each page starts small, so its first rows show as soon as it is opened
            let first = if have % pr_list::PAGE == 0 { FIRST_CHUNK } else { CHUNK.min(list.limit - have) };
            let page = self.page(runner, cwd, repo, list.state, list.scope, first, list.cursor.as_deref()).await?;
            // a PR updated while paging moves to the top: it may come back a second time
            list.prs.extend(page.prs.into_iter().filter(|p| seen.insert(p.number)));
            list.complete = page.next.is_none();
            list.cursor = page.next;
            list.at = now_secs();
            if progressive {
                lock(&self.lists).insert(k.clone(), list.clone());
                let _ = self.events.send(Event::PullRequests(list.clone()));
            }
        }
        Ok(list)
    }

    #[allow(clippy::too_many_arguments)]
    async fn page(&self, runner: &ProcessRunner, cwd: &Path, repo: &GithubRepo, state: ListState, scope: Scope, first: u32, cursor: Option<&str>) -> anyhow::Result<pr_list::Page> {
        let body = pr_list::request(repo, state, scope, first, cursor);
        let out = match runner.gh(cwd, pr_list::ARGS, Some(body.clone())).await {
            Ok(out) if !out.ok() && gateway_timeout(&String::from_utf8_lossy(&out.stderr)) => {
                tokio::time::sleep(RETRY_AFTER).await;
                runner.gh(cwd, pr_list::ARGS, Some(body)).await
            }
            out => out,
        }
        .map_err(gh_error)?;
        match pr_list::parse(&out.stdout) {
            Ok(page) => Ok(page),
            // gh exits 1 on GraphQL errors, printing them: those say more than stderr
            Err(message) if !out.stdout.trim_ascii().is_empty() => anyhow::bail!("{message}"),
            Err(_) => Err(gh_error(RunError::Failed { code: out.code, stderr: String::from_utf8_lossy(&out.stderr).trim().to_string() })),
        }
    }
}
