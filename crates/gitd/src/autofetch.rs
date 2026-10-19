use crate::hub::Hub;
use std::{sync::Arc, time::Duration};
use workspace::{backoff::FetchBackoff, sync::SyncOutcome};

pub async fn run(hub: Arc<Hub>, interval: Duration) {
    let mut backoff = FetchBackoff::default();
    let mut offline = false;
    let mut ticker = tokio::time::interval(interval);
    for tick in 0u64.. {
        ticker.tick().await;
        let mut due: Vec<_> = hub.active().map(|e| e.id).filter(|&id| backoff.due(id, tick)).collect();
        if offline {
            // a single repo probes the network instead of every repo failing again
            due.truncate(1);
        }
        let results = hub.fetch(due).await;
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
