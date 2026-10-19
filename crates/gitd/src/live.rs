use crate::{autofetch, hub::Hub};
use std::{sync::Arc, time::Duration};
use tokio::{sync::mpsc, task::JoinHandle};
use workspace::{
    watch::{RepoWatcher, WatchTarget},
    RepoId,
};

pub struct LiveWorkspace {
    pub hub: Arc<Hub>,
    _watcher: RepoWatcher,
    refresher: JoinHandle<()>,
    fetcher: JoinHandle<()>,
}

impl Drop for LiveWorkspace {
    fn drop(&mut self) {
        self.refresher.abort();
        self.fetcher.abort();
    }
}

impl LiveWorkspace {
    pub fn start(hub: Arc<Hub>, targets: Vec<WatchTarget>, fetch_interval: Duration) -> notify::Result<Self> {
        let (tx, rx) = mpsc::unbounded_channel();
        let watcher = RepoWatcher::start(targets, tx)?;
        let refresher = tokio::spawn(refresh_loop(rx, hub.clone()));
        let fetcher = tokio::spawn(autofetch::run(hub.clone(), fetch_interval));
        Ok(Self { hub, _watcher: watcher, refresher, fetcher })
    }
}

async fn refresh_loop(mut changed: mpsc::UnboundedReceiver<Vec<RepoId>>, hub: Arc<Hub>) {
    while let Some(ids) = changed.recv().await {
        for id in ids {
            let hub = hub.clone();
            tokio::spawn(async move { hub.publish(id).await });
        }
    }
}
