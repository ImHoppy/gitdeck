use gitcore::{commands::log, GitRunner, RunError};
use std::{collections::HashMap, path::Path, sync::Arc};
use tokio::sync::Mutex;
use workspace::{
    history::{self, History},
    RepoId,
};

#[derive(Default)]
pub struct Histories {
    cache: Mutex<HashMap<RepoId, Arc<History>>>,
    views: Mutex<HashMap<RepoId, Arc<History>>>,
}

impl Histories {
    pub async fn current<R: GitRunner>(&self, runner: &R, id: RepoId, path: &Path, opts: history::LogOptions) -> Result<Arc<History>, RunError> {
        let mut key = history::key(runner, path).await?;
        // other options are another history: the key keeps the views and row windows apart
        if opts != history::LogOptions::default() {
            key.key = format!("{}{}{}", key.key, if opts.current_branch { "h" } else { "" }, if opts.first_parent { "f" } else { "" });
        }
        if let Some(h) = self.cache.lock().await.get(&id) {
            if h.key == key {
                return Ok(h.clone());
            }
        }
        let fresh = Arc::new(history::load(runner, path, key, opts).await?);
        self.cache.lock().await.insert(id, fresh.clone());
        Ok(fresh)
    }

    pub async fn cached(&self, id: RepoId) -> Option<Arc<History>> {
        self.cache.lock().await.get(&id).cloned()
    }

    /// The open history narrowed by `query`: on message, author and hash, or with `content` on
    /// what the commits' diffs add or remove. The view's key is `<history key>:<m|c><query>`.
    pub async fn filtered<R: GitRunner>(&self, runner: &R, id: RepoId, path: &Path, query: &str, content: bool) -> Option<Arc<History>> {
        let full = self.cached(id).await?;
        let key = format!("{}:{}{query}", full.key.key, if content { 'c' } else { 'm' });
        if let Some(v) = self.views.lock().await.get(&id).filter(|v| v.key.key == key) {
            return Some(v.clone());
        }
        let view = Arc::new(if content {
            let args = log::content_search_args(query);
            let args: Vec<&str> = args.iter().map(String::as_str).collect();
            let out = runner.run_ok(path, &args).await.ok()?;
            full.only(&log::parse_shas(&out).into_iter().collect(), &key)
        } else {
            let mut view = full.filtered(query);
            view.key.key = key;
            view
        });
        self.views.lock().await.insert(id, view.clone());
        Some(view)
    }
}
