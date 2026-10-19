use gitcore::{GitRunner, RunError};
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
    pub async fn current<R: GitRunner>(&self, runner: &R, id: RepoId, path: &Path) -> Result<Arc<History>, RunError> {
        let key = history::key(runner, path).await?;
        if let Some(h) = self.cache.lock().await.get(&id) {
            if h.key == key {
                return Ok(h.clone());
            }
        }
        let fresh = Arc::new(history::load(runner, path, key).await?);
        self.cache.lock().await.insert(id, fresh.clone());
        Ok(fresh)
    }

    pub async fn cached(&self, id: RepoId) -> Option<Arc<History>> {
        self.cache.lock().await.get(&id).cloned()
    }

    pub async fn filtered(&self, id: RepoId, query: &str) -> Option<Arc<History>> {
        let full = self.cached(id).await?;
        let key = format!("{}:{query}", full.key.key);
        let mut views = self.views.lock().await;
        if let Some(v) = views.get(&id).filter(|v| v.key.key == key) {
            return Some(v.clone());
        }
        let view = Arc::new(full.filtered(query));
        views.insert(id, view.clone());
        Some(view)
    }
}
