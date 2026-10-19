use crate::RepoId;
use std::{collections::HashMap, future::Future, sync::Arc};
use tokio::sync::Mutex;

#[derive(Default)]
pub struct Scheduler {
    queues: std::sync::Mutex<HashMap<RepoId, Arc<Mutex<()>>>>,
}

impl Scheduler {
    pub async fn write<T>(&self, id: RepoId, job: impl Future<Output = T>) -> T {
        let queue = self.queues.lock().unwrap().entry(id).or_default().clone();
        let _turn = queue.lock().await;
        job.await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Duration;

    #[tokio::test]
    async fn serializes_writes_per_repo() {
        let s = Arc::new(Scheduler::default());
        let log = Arc::new(std::sync::Mutex::new(Vec::new()));
        let job = |n: u32, ms: u64| {
            let (s, log) = (s.clone(), log.clone());
            tokio::spawn(async move {
                s.write(1, async {
                    log.lock().unwrap().push(n);
                    tokio::time::sleep(Duration::from_millis(ms)).await;
                    log.lock().unwrap().push(n);
                })
                .await
            })
        };
        let a = job(1, 30);
        tokio::time::sleep(Duration::from_millis(5)).await;
        let b = job(2, 1);
        let _ = tokio::join!(a, b);
        assert_eq!(*log.lock().unwrap(), vec![1, 1, 2, 2]);
    }
}
