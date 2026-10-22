use crate::hub::Hub;
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc,
    },
    time::Duration,
};
use workspace::{backoff::FetchBackoff, sync::SyncOutcome};

/// Told which repos were just fetched (the PR lists refresh then).
pub type AfterFetch = Arc<dyn Fn(Vec<PathBuf>) + Send + Sync>;

/// Fetches on every tick while a page is open; with none (gitd kept running) it waits.
pub async fn run(hub: Arc<Hub>, interval: Duration, clients: Arc<AtomicUsize>, after: AfterFetch) {
    let mut backoff = FetchBackoff::default();
    let mut offline = false;
    let mut ticker = tokio::time::interval(interval);
    let mut next = 0u64;
    loop {
        ticker.tick().await;
        let tick = next;
        next += 1;
        if clients.load(Ordering::SeqCst) == 0 {
            continue;
        }
        let mut due: Vec<_> = hub.active().map(|e| e.id).filter(|&id| backoff.due(id, tick)).collect();
        if offline {
            // a single repo probes the network instead of every repo failing again
            due.truncate(1);
        }
        let results = hub.fetch(due).await;
        after(results.iter().filter_map(|r| hub.entries.get(&r.id).map(|e| e.path.clone())).collect());
        let failed = |o: &SyncOutcome| matches!(o, SyncOutcome::Failed { .. } | SyncOutcome::AuthFailed);
        let all_failed = !results.is_empty() && results.iter().all(|r| failed(&r.outcome));
        if offline || (all_failed && results.len() > 1) {
            offline = all_failed;
            continue;
        }
        for r in results {
            backoff.record(r.id, !failed(&r.outcome));
        }
    }
}
