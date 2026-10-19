use gitcore::{GitRunner, RunError};
use std::{collections::HashMap, path::Path, sync::Arc};
use tokio::sync::Mutex;
use workspace::{
    history::{self, History},
    RepoId,
};

/// One cached history per repo, reloaded only when its HEAD or refs change.
#[derive(Default)]
pub struct Histories {
    cache: Mutex<HashMap<RepoId, Arc<History>>>,
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
}
