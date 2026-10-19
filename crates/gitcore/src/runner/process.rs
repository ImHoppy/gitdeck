use super::{env::NO_PROMPT_ENV, CommandRecord, CommandSink, GitOutput, GitRunner, RunError};
use std::{
    path::Path,
    process::Stdio,
    sync::Arc,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::sync::Semaphore;
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone)]
pub struct ProcessRunner {
    pub timeout: Duration,
    limit: Arc<Semaphore>,
    sink: Option<CommandSink>,
}

const DEFAULT_MAX_PROCESSES: usize = 6;

impl ProcessRunner {
    pub fn new(max_processes: usize) -> Self {
        Self { timeout: Duration::from_secs(60), limit: Arc::new(Semaphore::new(max_processes)), sink: None }
    }

    pub fn with_sink(mut self, sink: CommandSink) -> Self {
        self.sink = Some(sink);
        self
    }
}

impl Default for ProcessRunner {
    fn default() -> Self {
        Self::new(DEFAULT_MAX_PROCESSES)
    }
}

impl GitRunner for ProcessRunner {
    async fn run(&self, cwd: &Path, args: &[&str]) -> Result<GitOutput, RunError> {
        let _permit = self.limit.acquire().await.expect("semaphore never closed");
        let started = Instant::now();
        let out = self.spawn(cwd, args).await;
        if let Some(sink) = &self.sink {
            sink(CommandRecord {
                cwd: cwd.to_string_lossy().into_owned(),
                args: args.iter().map(|a| a.to_string()).collect(),
                code: out.as_ref().map_or(-1, |o| o.code),
                millis: started.elapsed().as_millis() as u64,
                at: SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs()),
            });
        }
        out
    }
}

impl ProcessRunner {
    async fn spawn(&self, cwd: &Path, args: &[&str]) -> Result<GitOutput, RunError> {
        let mut cmd = Command::new("git");
        cmd.args(args)
            .current_dir(cwd)
            .envs(NO_PROMPT_ENV.iter().copied())
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        #[cfg(windows)]
        cmd.creation_flags(CREATE_NO_WINDOW);
        let child = cmd.spawn()?;
        let out = tokio::time::timeout(self.timeout, child.wait_with_output())
            .await
            .map_err(|_| RunError::Timeout)??;
        Ok(GitOutput {
            stdout: out.stdout,
            stderr: out.stderr,
            code: out.status.code().unwrap_or(-1),
        })
    }
}
