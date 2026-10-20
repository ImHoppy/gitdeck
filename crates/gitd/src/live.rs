use crate::{autofetch, hub::Hub};
use std::{
    sync::{atomic::AtomicUsize, Arc},
    time::Duration,
};
use tokio::{sync::mpsc, task::JoinHandle};
use workspace::{
    watch::{IgnoreList, RepoWatcher, WatchTarget},
    RepoId,
};

pub struct LiveWorkspace {
    pub name: String,
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
    pub fn ignore_list(&self) -> IgnoreList {
        self._watcher.ignore_list()
    }

    pub fn start(name: String, hub: Arc<Hub>, targets: Vec<WatchTarget>, fetch_interval: Duration, clients: Arc<AtomicUsize>) -> notify::Result<Self> {
        let (tx, rx) = mpsc::unbounded_channel();
        let watcher = RepoWatcher::start(targets, tx)?;
        let refresher = tokio::spawn(refresh_loop(rx, hub.clone()));
        let fetcher = tokio::spawn(autofetch::run(hub.clone(), fetch_interval, clients));
        Ok(Self { name, hub, _watcher: watcher, refresher, fetcher })
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
