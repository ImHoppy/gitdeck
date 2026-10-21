use super::{env::NO_PROMPT_ENV, CommandRecord, CommandSink, Console, GitOutput, GitRunner, RunError};
use std::{
    path::Path,
    process::Stdio,
    path::PathBuf,
    sync::{Arc, RwLock},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tokio::io::AsyncReadExt;
use tokio::sync::Semaphore;
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Clone)]
pub struct ProcessRunner {
    pub timeout: Duration,
    limit: Arc<Semaphore>,
    interactive: Arc<Semaphore>,
    /// Shared by every clone, so changing it reaches the runners the hubs already hold.
    git: Arc<RwLock<PathBuf>>,
    sink: Option<CommandSink>,
}

const DEFAULT_MAX_PROCESSES: usize = 6;
const INTERACTIVE_PROCESSES: usize = 4;

pub type OutputSink = Arc<dyn Fn(&[u8]) + Send + Sync>;

const LOG_TAIL: usize = 200;

tokio::task_local! {
    static INTERACTIVE: ();
    static STREAM: OutputSink;
}

/// Network calls inside `fut` time out only once they go quiet, so a long transfer is never cut off.
pub async fn streamed<F: std::future::Future>(sink: OutputSink, fut: F) -> F::Output {
    STREAM.scope(sink, fut).await
}

const NETWORK: &[&str] = &["fetch", "pull", "push", "clone"];

fn subcommand<'a>(args: &[&'a str]) -> Option<&'a str> {
    let mut it = args.iter();
    while let Some(&a) = it.next() {
        if a == "-c" || a == "-C" {
            it.next();
        } else if !a.starts_with('-') {
            return Some(a);
        }
    }
    None
}

/// Network calls inside `fut` time out only once they go quiet, so a long transfer is never cut off.
/// behind background status scans and fetches.
pub async fn interactive<F: std::future::Future>(fut: F) -> F::Output {
    INTERACTIVE.scope((), fut).await
}

impl ProcessRunner {
    pub fn new(max_processes: usize) -> Self {
        Self {
            timeout: Duration::from_secs(60),
            limit: Arc::new(Semaphore::new(max_processes)),
            interactive: Arc::new(Semaphore::new(INTERACTIVE_PROCESSES)),
            git: Arc::new(RwLock::new(PathBuf::from("git"))),
            sink: None,
        }
    }

    /// The git executable to run; `None` means `git` from PATH.
    pub fn set_git(&self, path: Option<PathBuf>) {
        *self.git.write().unwrap_or_else(|e| e.into_inner()) = path.unwrap_or_else(|| PathBuf::from("git"));
    }

    pub fn git(&self) -> PathBuf {
        self.git.read().unwrap_or_else(|e| e.into_inner()).clone()
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
        let lane = if INTERACTIVE.try_with(|_| ()).is_ok() { &self.interactive } else { &self.limit };
        let _permit = lane.acquire().await.expect("semaphore never closed");
        let started = Instant::now();
        let stream = STREAM.try_with(|s| s.clone()).ok().filter(|_| subcommand(args).is_some_and(|c| NETWORK.contains(&c)));
        let out = self.spawn(cwd, args, stream).await;
        if let Some(sink) = &self.sink {
            sink(CommandRecord {
                cwd: cwd.to_string_lossy().into_owned(),
                args: args.iter().map(|a| a.to_string()).collect(),
                code: out.as_ref().map_or(-1, |o| o.code),
                millis: started.elapsed().as_millis() as u64,
                at: SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs()),
                output: match &out {
                    Ok(o) if o.ok() => String::new(),
                    Ok(o) => {
                        let mut console = Console::default();
                        console.feed(&o.stderr);
                        console.tail(LOG_TAIL)
                    }
                    Err(e) => e.to_string(),
                },
            });
        }
        out
    }
}

impl ProcessRunner {
    async fn spawn(&self, cwd: &Path, args: &[&str], stream: Option<OutputSink>) -> Result<GitOutput, RunError> {
        let mut cmd = Command::new(self.git());
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
        if let Some(sink) = stream {
            sink(format!("$ git {}
", args.join(" ")).as_bytes());
            return self.drain(child, sink).await;
        }
        let out = tokio::time::timeout(self.timeout, child.wait_with_output())
            .await
            .map_err(|_| RunError::Timeout)??;
        Ok(GitOutput {
            stdout: out.stdout,
            stderr: out.stderr,
            code: out.status.code().unwrap_or(-1),
        })
    }

    async fn drain(&self, mut child: tokio::process::Child, sink: OutputSink) -> Result<GitOutput, RunError> {
        let (mut so, mut se) = (child.stdout.take().expect("piped"), child.stderr.take().expect("piped"));
        let (mut stdout, mut stderr) = (Vec::new(), Vec::new());
        let (mut ob, mut eb) = ([0u8; 8192], [0u8; 8192]);
        let (mut out_open, mut err_open) = (true, true);
        while out_open || err_open {
            let read = tokio::time::timeout(self.timeout, async {
                tokio::select! {
                    n = so.read(&mut ob), if out_open => (true, n),
                    n = se.read(&mut eb), if err_open => (false, n),
                }
            })
            .await
            .map_err(|_| RunError::Timeout)?;
            match read {
                (true, Ok(0)) => out_open = false,
                (false, Ok(0)) => err_open = false,
                (true, Ok(n)) => {
                    sink(&ob[..n]);
                    stdout.extend_from_slice(&ob[..n]);
                }
                (false, Ok(n)) => {
                    sink(&eb[..n]);
                    stderr.extend_from_slice(&eb[..n]);
                }
                (_, Err(e)) => return Err(e.into()),
            }
        }
        let status = tokio::time::timeout(self.timeout, child.wait()).await.map_err(|_| RunError::Timeout)??;
        Ok(GitOutput { stdout, stderr, code: status.code().unwrap_or(-1) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_the_subcommand_past_config_flags() {
        assert_eq!(subcommand(&["-c", "rebase.autoStash=true", "pull", "--rebase"]), Some("pull"));
        assert_eq!(subcommand(&["--no-pager", "fetch"]), Some("fetch"));
        assert_eq!(subcommand(&["-c", "a=b"]), None);
    }
}
