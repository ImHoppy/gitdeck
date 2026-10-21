use crate::{autofetch::{self, AfterFetch}, hub::Hub};
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
    fetcher: Option<JoinHandle<()>>,
    clients: Arc<AtomicUsize>,
    after_fetch: AfterFetch,
}

impl Drop for LiveWorkspace {
    fn drop(&mut self) {
        self.refresher.abort();
        if let Some(f) = &self.fetcher {
            f.abort();
        }
    }
}

impl LiveWorkspace {
    pub fn ignore_list(&self) -> IgnoreList {
        self._watcher.ignore_list()
    }

    pub fn start(
        name: String,
        hub: Arc<Hub>,
        targets: Vec<WatchTarget>,
        fetch_interval: Duration,
        clients: Arc<AtomicUsize>,
        after_fetch: AfterFetch,
    ) -> notify::Result<Self> {
        let (tx, rx) = mpsc::unbounded_channel();
        let watcher = RepoWatcher::start(targets, tx)?;
        let refresher = tokio::spawn(refresh_loop(rx, hub.clone()));
        let fetcher = fetcher(&hub, fetch_interval, &clients, &after_fetch);
        Ok(Self { name, hub, _watcher: watcher, refresher, fetcher, clients, after_fetch })
    }

    /// A zero interval turns auto fetch off.
    pub fn set_fetch_interval(&mut self, interval: Duration) {
        if let Some(f) = self.fetcher.take() {
            f.abort();
        }
        self.fetcher = fetcher(&self.hub, interval, &self.clients, &self.after_fetch);
    }
}

fn fetcher(hub: &Arc<Hub>, interval: Duration, clients: &Arc<AtomicUsize>, after: &AfterFetch) -> Option<JoinHandle<()>> {
    (!interval.is_zero()).then(|| tokio::spawn(autofetch::run(hub.clone(), interval, clients.clone(), after.clone())))
}

async fn refresh_loop(mut changed: mpsc::UnboundedReceiver<Vec<RepoId>>, hub: Arc<Hub>) {
    while let Some(ids) = changed.recv().await {
        for id in ids {
            let hub = hub.clone();
            tokio::spawn(async move { hub.publish_if_changed(id).await });
        }
    }
}
