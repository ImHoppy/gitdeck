mod env;
mod process;

pub use process::ProcessRunner;

use std::path::Path;

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
