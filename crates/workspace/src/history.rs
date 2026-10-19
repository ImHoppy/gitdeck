use gitcore::{
    commands::{head, log, refs},
    GitRunner, RunError,
};
use serde::Serialize;
use std::{
    collections::HashMap,
    hash::{DefaultHasher, Hash, Hasher},
    path::Path,
};

pub use log::LogCommit;
pub use refs::GitRef;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryKey {
    pub key: String,
    pub head: Option<String>,
    pub refs: Vec<GitRef>,
}

pub struct History {
    pub key: HistoryKey,
    pub commits: Vec<LogCommit>,
    pub rows: Vec<graph::Row>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryRow<'a> {
    pub sha: &'a str,
    pub parents: &'a [String],
    pub author: &'a str,
    pub email: &'a str,
    pub time: i64,
    pub subject: &'a str,
    pub body_hint: &'a str,
    pub multiline: bool,
    pub graph: &'a graph::Row,
}

pub async fn key<R: GitRunner>(runner: &R, path: &Path) -> Result<HistoryKey, RunError> {
    let (refs_out, sha) = futures::try_join!(runner.run_ok(path, refs::ARGS), runner.run(path, head::SHA_ARGS))?;
    let head = sha.ok().then(|| String::from_utf8_lossy(&sha.stdout).trim().to_string());
    let mut h = DefaultHasher::new();
    refs_out.hash(&mut h);
    head.hash(&mut h);
    Ok(HistoryKey { key: format!("{:016x}", h.finish()), head, refs: refs::parse(&refs_out) })
}

pub async fn load<R: GitRunner>(runner: &R, path: &Path, key: HistoryKey) -> Result<History, RunError> {
    let out = runner.run(path, log::ARGS).await?;
    // an unborn HEAD makes git log fail: that repo simply has no history yet
    let commits = if out.ok() { log::parse(&out.stdout) } else { Vec::new() };
    let rows = graph::layout(&parent_indices(&commits));
    Ok(History { key, commits, rows })
}

impl History {
    pub fn window(&self, start: usize, count: usize) -> Vec<HistoryRow<'_>> {
        let end = (start + count).min(self.commits.len());
        (start.min(end)..end)
            .map(|i| {
                let c = &self.commits[i];
                HistoryRow {
                    sha: &c.sha,
                    parents: &c.parents,
                    author: &c.author,
                    email: &c.email,
                    time: c.author_time,
                    subject: &c.subject,
                    body_hint: &c.body_hint,
                    multiline: c.multiline,
                    graph: &self.rows[i],
                }
            })
            .collect()
    }

    pub fn index_of(&self, sha: &str) -> Option<usize> {
        self.commits.iter().position(|c| c.sha.starts_with(sha))
    }
}

fn parent_indices(commits: &[LogCommit]) -> Vec<Vec<u32>> {
    let index: HashMap<&str, u32> = commits.iter().enumerate().map(|(i, c)| (c.sha.as_str(), i as u32)).collect();
    commits
        .iter()
        .map(|c| c.parents.iter().filter_map(|p| index.get(p.as_str()).copied()).collect())
        .collect()
}
