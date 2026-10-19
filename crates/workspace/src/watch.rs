use crate::registry::RepoId;
use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    time::Duration,
};
use tokio::sync::mpsc;

const DEBOUNCE: Duration = Duration::from_millis(300);
const IGNORED_SEGMENTS: &[&str] = &["/objects/", "/logs/", "/node_modules/"];

pub struct WatchTarget {
    pub id: RepoId,
    pub worktree: PathBuf,
    pub gitdir: Option<PathBuf>,
}

pub struct RepoWatcher {
    _watcher: RecommendedWatcher,
}

impl RepoWatcher {
    pub fn start(
        targets: Vec<WatchTarget>,
        changed: mpsc::UnboundedSender<Vec<RepoId>>,
    ) -> notify::Result<Self> {
        let prefixes = Prefixes::new(&targets);
        let (raw_tx, raw_rx) = mpsc::unbounded_channel::<RepoId>();
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            for path in &event.paths {
                if let Some(id) = prefixes.repo_for(path) {
                    let _ = raw_tx.send(id);
                }
            }
        })?;
        for root in watch_roots(&targets) {
            watcher.watch(&root, RecursiveMode::Recursive)?;
        }
        tokio::spawn(debounce(raw_rx, changed));
        Ok(Self { _watcher: watcher })
    }
}

async fn debounce(mut raw: mpsc::UnboundedReceiver<RepoId>, out: mpsc::UnboundedSender<Vec<RepoId>>) {
    while let Some(first) = raw.recv().await {
        let mut ids = HashSet::from([first]);
        let deadline = tokio::time::sleep(DEBOUNCE);
        tokio::pin!(deadline);
        loop {
            tokio::select! {
                _ = &mut deadline => break,
                next = raw.recv() => match next {
                    Some(id) => { ids.insert(id); }
                    None => return,
                },
            }
        }
        if out.send(ids.into_iter().collect()).is_err() {
            return;
        }
    }
}

fn watch_roots(targets: &[WatchTarget]) -> Vec<PathBuf> {
    let mut all: Vec<PathBuf> = targets
        .iter()
        .flat_map(|t| std::iter::once(t.worktree.clone()).chain(t.gitdir.clone()))
        .collect();
    all.sort_by_key(|p| key(p));
    let mut roots: Vec<PathBuf> = Vec::new();
    for p in all {
        if !roots.iter().any(|r| is_under(&key(&p), &key(r))) {
            roots.push(p);
        }
    }
    roots
}

struct Prefixes(Vec<(String, RepoId)>);

impl Prefixes {
    fn new(targets: &[WatchTarget]) -> Self {
        let mut v: Vec<(String, RepoId)> = targets
            .iter()
            .flat_map(|t| {
                std::iter::once((key(&t.worktree), t.id)).chain(t.gitdir.iter().map(|g| (key(g), t.id)))
            })
            .collect();
        v.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
        Self(v)
    }

    fn repo_for(&self, path: &Path) -> Option<RepoId> {
        let p = key(path);
        if is_noise(&p) {
            return None;
        }
        self.0.iter().find(|(k, _)| is_under(&p, k)).map(|(_, id)| *id)
    }
}

fn is_noise(p: &str) -> bool {
    p.ends_with(".lock") || IGNORED_SEGMENTS.iter().any(|s| p.contains(s))
}

fn is_under(path: &str, dir: &str) -> bool {
    path == dir || path.starts_with(&format!("{dir}/"))
}

fn key(p: &Path) -> String {
    crate::config::normalize(p)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn target(id: RepoId, wt: &str, gd: &str) -> WatchTarget {
        WatchTarget { id, worktree: wt.into(), gitdir: Some(gd.into()) }
    }

    #[test]
    fn maps_paths_to_deepest_repo() {
        let t = vec![target(0, "/r", "/r/.git"), target(1, "/r/sub", "/r/.git/modules/sub")];
        let p = Prefixes::new(&t);
        assert_eq!(p.repo_for(Path::new("/r/a.txt")), Some(0));
        assert_eq!(p.repo_for(Path::new("/r/sub/b.txt")), Some(1));
        assert_eq!(p.repo_for(Path::new("/r/.git/modules/sub/HEAD")), Some(1));
        assert_eq!(p.repo_for(Path::new("/r/.git/index.lock")), None);
        assert_eq!(p.repo_for(Path::new("/r/.git/objects/ab/cd")), None);
        assert_eq!(watch_roots(&t), vec![PathBuf::from("/r")]);
    }
}
