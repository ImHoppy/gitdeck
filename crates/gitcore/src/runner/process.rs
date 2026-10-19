use super::{env::NO_PROMPT_ENV, GitOutput, GitRunner, RunError};
use std::{path::Path, process::Stdio, time::Duration};
use tokio::process::Command;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone)]
pub struct ProcessRunner {
    pub timeout: Duration,
}

impl Default for ProcessRunner {
    fn default() -> Self {
        Self { timeout: Duration::from_secs(60) }
    }
}

impl GitRunner for ProcessRunner {
    async fn run(&self, cwd: &Path, args: &[&str]) -> Result<GitOutput, RunError> {
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
