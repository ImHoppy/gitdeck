use crate::registry::RepoId;
use notify::{
    event::ModifyKind,
    EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::{
    collections::{HashMap, HashSet},
    path::{Path, PathBuf},
    sync::{Arc, RwLock},
    time::{Duration, Instant},
};
use tokio::sync::mpsc;

const DEBOUNCE: Duration = Duration::from_millis(300);
const MIN_GAP: Duration = Duration::from_secs(2);
const IGNORED_SEGMENTS: &[&str] = &["/objects/", "/logs/", "/node_modules/"];

pub struct WatchTarget {
    pub id: RepoId,
    pub worktree: PathBuf,
    pub gitdir: Option<PathBuf>,
    /// Git-ignored paths under the worktree: tools writing there (caches, browser profiles) are not changes.
    pub ignored: Vec<PathBuf>,
}

pub struct RepoWatcher {
    _watcher: RecommendedWatcher,
    ignored: IgnoreList,
}

/// Ignored paths the watcher skips; filled in after start, since listing them can take a while.
#[derive(Clone, Default)]
pub struct IgnoreList(Arc<RwLock<Vec<String>>>);

impl IgnoreList {
    pub fn add(&self, worktree: &Path, paths: impl IntoIterator<Item = PathBuf>) {
        let mut list = self.0.write().unwrap_or_else(|e| e.into_inner());
        list.extend(paths.into_iter().map(|p| key(&worktree.join(p))));
    }

    fn covers(&self, p: &str) -> bool {
        self.0.read().unwrap_or_else(|e| e.into_inner()).iter().any(|i| is_under(p, i))
    }
}

impl RepoWatcher {
    pub fn start(
        targets: Vec<WatchTarget>,
        changed: mpsc::UnboundedSender<Vec<RepoId>>,
    ) -> notify::Result<Self> {
        let prefixes = Prefixes::new(&targets);
        let ignored = prefixes.ignored.clone();
        let (raw_tx, raw_rx) = mpsc::unbounded_channel::<RepoId>();
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };
            // reads by our own status refresh show up as access/metadata events and would loop
            if matches!(event.kind, EventKind::Access(_) | EventKind::Modify(ModifyKind::Metadata(_))) {
                return;
            }
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
        Ok(Self { _watcher: watcher, ignored })
    }

    pub fn ignore_list(&self) -> IgnoreList {
        self.ignored.clone()
    }
}

async fn debounce(mut raw: mpsc::UnboundedReceiver<RepoId>, out: mpsc::UnboundedSender<Vec<RepoId>>) {
    let mut last: HashMap<RepoId, Instant> = HashMap::new();
    let mut held: HashSet<RepoId> = HashSet::new();
    loop {
        let mut ids = std::mem::take(&mut held);
        if ids.is_empty() {
            match raw.recv().await {
                Some(id) => {
                    ids.insert(id);
                }
                None => return,
            }
        }
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
        // a repo written to constantly (a cache in an untracked folder) refreshes at most once per MIN_GAP
        let now = Instant::now();
        let (ready, wait): (Vec<RepoId>, Vec<RepoId>) =
            ids.into_iter().partition(|id| last.get(id).is_none_or(|t| now.duration_since(*t) >= MIN_GAP));
        held.extend(wait);
        for id in &ready {
            last.insert(*id, now);
        }
        if !ready.is_empty() && out.send(ready).is_err() {
            return;
        }
        if !held.is_empty() {
            tokio::time::sleep(MIN_GAP).await;
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

struct Prefixes {
    repos: Vec<(String, RepoId)>,
    ignored: IgnoreList,
}

impl Prefixes {
    fn new(targets: &[WatchTarget]) -> Self {
        let mut v: Vec<(String, RepoId)> = targets
            .iter()
            .flat_map(|t| {
                std::iter::once((key(&t.worktree), t.id)).chain(t.gitdir.iter().map(|g| (key(g), t.id)))
            })
            .collect();
        v.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
        let ignored = IgnoreList::default();
        for t in targets {
            ignored.add(&t.worktree, t.ignored.iter().cloned());
        }
        Self { repos: v, ignored }
    }

    fn repo_for(&self, path: &Path) -> Option<RepoId> {
        let p = key(path);
        if is_noise(&p) || self.ignored.covers(&p) {
            return None;
        }
        self.repos.iter().find(|(k, _)| is_under(&p, k)).map(|(_, id)| *id)
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
        WatchTarget { id, worktree: wt.into(), gitdir: Some(gd.into()), ignored: vec!["tmp".into()] }
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
        assert_eq!(p.repo_for(Path::new("/r/tmp/cache/x")), None);
        assert_eq!(p.repo_for(Path::new("/r/tmpfile")), Some(0));
        assert_eq!(watch_roots(&t), vec![PathBuf::from("/r")]);
    }
}
