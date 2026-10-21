mod console;
mod env;
mod process;

pub use console::Console;
pub use process::{interactive, streamed, OutputSink, ProcessRunner};

use serde::Serialize;
use std::{path::Path, sync::Arc};

#[derive(Debug, Clone, Serialize)]
pub struct CommandRecord {
    /// `git` or `gh`.
    pub program: &'static str,
    pub cwd: String,
    pub args: Vec<String>,
    pub code: i32,
    pub millis: u64,
    pub at: u64,
    #[serde(skip_serializing_if = "String::is_empty")]
    pub output: String,
}

pub type CommandSink = Arc<dyn Fn(CommandRecord) + Send + Sync>;

#[derive(Debug, Clone)]
pub struct GitOutput {
    pub stdout: Vec<u8>,
    pub stderr: Vec<u8>,
    pub code: i32,
}

impl GitOutput {
    pub fn ok(&self) -> bool {
        self.code == 0
    }
}

#[derive(Debug, thiserror::Error)]
pub enum RunError {
    #[error("failed to spawn git: {0}")]
    Spawn(#[from] std::io::Error),
    #[error("git timed out")]
    Timeout,
    #[error("git exited with {code}: {stderr}")]
    Failed { code: i32, stderr: String },
}

pub trait GitRunner: Send + Sync {
    fn run(
        &self,
        cwd: &Path,
        args: &[&str],
    ) -> impl std::future::Future<Output = Result<GitOutput, RunError>> + Send;

    /// Like `run`, with `input` written to git's stdin.
    fn run_input(
        &self,
        cwd: &Path,
        args: &[&str],
        input: Vec<u8>,
    ) -> impl std::future::Future<Output = Result<GitOutput, RunError>> + Send;

    fn run_ok(
        &self,
        cwd: &Path,
        args: &[&str],
    ) -> impl std::future::Future<Output = Result<Vec<u8>, RunError>> + Send {
        async move {
            let out = self.run(cwd, args).await?;
            if out.ok() {
                Ok(out.stdout)
            } else {
                Err(RunError::Failed {
                    code: out.code,
                    stderr: String::from_utf8_lossy(&out.stderr).trim().to_string(),
                })
            }
        }
    }
}

/// The GitHub CLI, run with the same rules as git: logged, no prompt, a timeout.
pub trait GhRunner: Send + Sync {
    fn gh(
        &self,
        cwd: &Path,
        args: &[&str],
        input: Option<Vec<u8>>,
    ) -> impl std::future::Future<Output = Result<GitOutput, RunError>> + Send;

    fn gh_ok(&self, cwd: &Path, args: &[&str]) -> impl std::future::Future<Output = Result<Vec<u8>, RunError>> + Send {
        async move {
            let out = self.gh(cwd, args, None).await?;
            if out.ok() {
                Ok(out.stdout)
            } else {
                Err(RunError::Failed { code: out.code, stderr: String::from_utf8_lossy(&out.stderr).trim().to_string() })
            }
        }
    }
}
