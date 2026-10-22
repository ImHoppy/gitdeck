use crate::events::{Event, WorkspaceEvents};
use gitcore::{streamed, Console};
use serde::Serialize;
use std::{
    collections::VecDeque,
    sync::{
        atomic::{AtomicU64, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use workspace::{sync::SyncOutcome, RepoId};

const KEEP_DONE: usize = 20;
const THROTTLE: Duration = Duration::from_millis(250);

/// As an event, `lines` starts at index `from`.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobUpdate {
    pub id: u64,
    pub repo_id: RepoId,
    pub title: String,
    pub background: bool,
    pub from: usize,
    pub lines: Vec<String>,
    pub current: String,
    pub done: Option<SyncOutcome>,
}

struct Job {
    id: u64,
    repo_id: RepoId,
    title: String,
    background: bool,
    console: Console,
    sent: usize,
    last_sent: Instant,
    done: Option<SyncOutcome>,
}

impl Job {
    fn update(&mut self, from: usize) -> JobUpdate {
        let lines = self.console.lines()[from..].to_vec();
        self.sent = self.console.lines().len();
        self.last_sent = Instant::now();
        JobUpdate {
            id: self.id,
            repo_id: self.repo_id,
            title: self.title.clone(),
            background: self.background,
            from,
            lines,
            current: self.console.current(),
            done: self.done.clone(),
        }
    }
}

pub struct Jobs {
    next: AtomicU64,
    all: Arc<Mutex<VecDeque<Job>>>,
    events: WorkspaceEvents,
}

impl Jobs {
    pub fn new(events: WorkspaceEvents) -> Self {
        Self { next: AtomicU64::new(1), all: Default::default(), events }
    }

    pub async fn run(
        &self,
        repo_id: RepoId,
        title: String,
        background: bool,
        fut: impl std::future::Future<Output = SyncOutcome>,
    ) -> SyncOutcome {
        let id = self.next.fetch_add(1, Ordering::Relaxed);
        let mut job = Job { id, repo_id, title, background, console: Console::default(), sent: 0, last_sent: Instant::now(), done: None };
        self.events.send(Event::Job(job.update(0)));
        self.lock().push_back(job);

        let (all, events) = (self.all.clone(), self.events.clone());
        let sink = Arc::new(move |chunk: &[u8]| {
            let mut all = all.lock().unwrap_or_else(|e| e.into_inner());
            let Some(job) = all.iter_mut().find(|j| j.id == id) else { return };
            job.console.feed(chunk);
            if job.last_sent.elapsed() >= THROTTLE {
                events.send(Event::Job(job.update(job.sent)));
            }
        });
        let outcome = streamed(sink, fut).await;

        let mut all = self.lock();
        if let Some(job) = all.iter_mut().find(|j| j.id == id) {
            job.done = Some(outcome.clone());
            self.events.send(Event::Job(job.update(job.sent)));
        }
        while all.iter().filter(|j| j.done.is_some()).count() > KEEP_DONE {
            let oldest = all.iter().position(|j| j.done.is_some()).expect("counted above");
            all.remove(oldest);
        }
        outcome
    }

    pub fn list(&self) -> Vec<JobUpdate> {
        self.lock().iter_mut().map(|j| j.update(0)).collect()
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, VecDeque<Job>> {
        self.all.lock().unwrap_or_else(|e| e.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gitcore::{GitRunner, ProcessRunner};
    use tokio::sync::broadcast;

    #[tokio::test]
    async fn streams_a_network_command_and_keeps_its_output() {
        let (tx, mut rx) = broadcast::channel(16);
        let jobs = Jobs::new(WorkspaceEvents::new("w", tx));
        let dir = std::env::temp_dir();
        let outcome = jobs
            .run(1, "Fetch a".into(), false, async {
                let out = ProcessRunner::default().run(&dir, &["fetch", "--progress"]).await.unwrap();
                SyncOutcome::Failed { message: String::from_utf8_lossy(&out.stderr).into() }
            })
            .await;
        assert!(matches!(outcome, SyncOutcome::Failed { .. }));
        let listed = jobs.list();
        assert_eq!(listed[0].lines[0], "$ git fetch --progress");
        assert!(listed[0].lines[1].starts_with("fatal:"));
        assert!(listed[0].done.is_some());
        assert!(matches!(rx.recv().await, Ok((_, Event::Job(JobUpdate { from: 0, .. })))));
    }
}
