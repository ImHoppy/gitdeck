use std::{
    sync::atomic::{AtomicBool, AtomicUsize, Ordering},
    time::Duration,
};
use tokio::sync::Notify;

/// Exits after the last client closes plus the grace period, never during a job (PLAN §2.1).
pub struct Lifecycle {
    clients: AtomicUsize,
    keep: AtomicBool,
    grace: Duration,
    pub shutdown: Notify,
}

const BUSY_POLL: Duration = Duration::from_secs(1);

impl Lifecycle {
    pub fn new(grace: Duration, keep: bool) -> Self {
        Self { clients: AtomicUsize::new(0), keep: AtomicBool::new(keep), grace, shutdown: Notify::new() }
    }

    pub fn keep_running(&self) -> bool {
        self.keep.load(Ordering::Relaxed)
    }

    pub fn set_keep_running(&self, on: bool) {
        self.keep.store(on, Ordering::Relaxed);
    }

    pub fn connected(&self) {
        self.clients.fetch_add(1, Ordering::SeqCst);
    }

    /// Call when a client leaves; `busy` says whether a job is still running.
    pub async fn disconnected(&self, busy: impl Fn() -> bool) {
        if self.clients.fetch_sub(1, Ordering::SeqCst) != 1 {
            return;
        }
        loop {
            tokio::time::sleep(self.grace).await;
            if self.clients.load(Ordering::SeqCst) > 0 || self.keep_running() {
                return;
            }
            if !busy() {
                self.shutdown.notify_one();
                return;
            }
            while busy() {
                tokio::time::sleep(BUSY_POLL).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::AtomicBool;

    const GRACE: Duration = Duration::from_millis(20);

    async fn exits(l: &Lifecycle) -> bool {
        tokio::time::timeout(Duration::from_millis(200), l.shutdown.notified()).await.is_ok()
    }

    #[tokio::test]
    async fn exits_after_the_last_client_and_the_grace_period() {
        let l = Lifecycle::new(GRACE, false);
        l.connected();
        l.disconnected(|| false).await;
        assert!(exits(&l).await);
    }

    #[tokio::test]
    async fn stays_up_when_kept_running_or_a_client_returns() {
        let l = Lifecycle::new(GRACE, true);
        l.connected();
        l.disconnected(|| false).await;
        assert!(!exits(&l).await);

        let l = std::sync::Arc::new(Lifecycle::new(GRACE, false));
        l.connected();
        let leaving = { let l = l.clone(); tokio::spawn(async move { l.disconnected(|| false).await }) };
        l.connected();
        leaving.await.unwrap();
        assert!(!exits(&l).await);
    }

    #[tokio::test]
    async fn waits_for_a_running_job() {
        let l = Lifecycle::new(GRACE, false);
        let busy = AtomicBool::new(true);
        l.connected();
        let done = async {
            tokio::time::sleep(Duration::from_millis(60)).await;
            busy.store(false, Ordering::SeqCst);
        };
        let (_, ()) = tokio::join!(l.disconnected(|| busy.load(Ordering::SeqCst)), done);
        assert!(!busy.load(Ordering::SeqCst));
        assert!(exits(&l).await);
    }
}
