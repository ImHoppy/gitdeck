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
    /// Commits whose subject, body, author, email or hash contain `query`, ignoring case.
    pub fn filtered(&self, query: &str) -> History {
        let q = query.to_lowercase();
        let hit = |c: &LogCommit| {
            [&c.subject, &c.body_hint, &c.author, &c.email].iter().any(|f| f.to_lowercase().contains(&q)) || c.sha.starts_with(&q)
        };
        let commits: Vec<LogCommit> = self.commits.iter().filter(|c| hit(c)).cloned().collect();
        let rows = graph::layout(&parent_indices(&commits));
        let mut key = self.key.clone();
        key.key = format!("{}:{query}", key.key);
        History { key, commits, rows }
    }

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

#[cfg(test)]
mod tests {
    use super::*;

    fn commit(sha: &str, subject: &str, author: &str) -> LogCommit {
        LogCommit {
            sha: sha.into(),
            parents: vec![],
            author_time: 0,
            author: author.into(),
            email: String::new(),
            subject: subject.into(),
            body_hint: String::new(),
            multiline: false,
        }
    }

    #[test]
    fn filters_on_subject_author_and_hash_prefix() {
        let commits = vec![commit("aa1", "Fix grid", "Ann"), commit("bb2", "add tree", "Bob"), commit("cc3", "docs", "ann")];
        let h = History {
            key: HistoryKey { key: "k".into(), head: None, refs: vec![] },
            rows: graph::layout(&parent_indices(&commits)),
            commits,
        };
        let shas = |q: &str| h.filtered(q).commits.into_iter().map(|c| c.sha).collect::<Vec<_>>();
        assert_eq!(shas("ann"), ["aa1", "cc3"]);
        assert_eq!(shas("TREE"), ["bb2"]);
        assert_eq!(shas("cc"), ["cc3"]);
        assert_eq!(h.filtered("x").key.key, "k:x");
    }
}
