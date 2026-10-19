use crate::state::{self, git_dir};
use gitcore::{
    commands::{head, operation, rebase, sync},
    GitRunner, RunError,
};
use serde::Deserialize;
use std::path::Path;

pub use rebase::RebaseAction;
pub use sync::SyncOutcome;

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncKind {
    Fetch,
    /// One button, like VS Code: fetch, rebase onto the upstream if behind, push if ahead.
    Sync,
}

pub async fn run<R: GitRunner>(runner: &R, path: &Path, kind: SyncKind) -> SyncOutcome {
    match guard(runner, path, kind).await {
        Ok(Some(reason)) => return SyncOutcome::Skipped { reason },
        Ok(None) => {}
        Err(e) => return failed(e),
    }
    let fetched = git(runner, path, sync::FETCH_ARGS).await;
    if matches!(kind, SyncKind::Fetch) || !succeeded(&fetched) {
        return fetched;
    }
    let tracking = match state::load(runner, path).await {
        Ok(s) => s.tracking,
        Err(e) => return failed(e),
    };
    let (Some(ahead), Some(behind)) = (tracking.ahead, tracking.behind) else {
        return SyncOutcome::Skipped { reason: "no upstream".into() };
    };
    if behind > 0 {
        let pulled = git(runner, path, sync::PULL_ARGS).await;
        if !succeeded(&pulled) {
            return pulled;
        }
    }
    if ahead > 0 {
        return git(runner, path, sync::PUSH_ARGS).await;
    }
    if behind > 0 { SyncOutcome::Done } else { SyncOutcome::UpToDate }
}

pub async fn rebase<R: GitRunner>(runner: &R, path: &Path, action: RebaseAction) -> SyncOutcome {
    git(runner, path, rebase::args(action)).await
}

async fn git<R: GitRunner>(runner: &R, path: &Path, args: &[&str]) -> SyncOutcome {
    match runner.run(path, args).await {
        Ok(out) => sync::classify(out.code, &out.stdout, &out.stderr),
        Err(e) => failed(e),
    }
}

fn succeeded(o: &SyncOutcome) -> bool {
    matches!(o, SyncOutcome::Done | SyncOutcome::UpToDate)
}

async fn guard<R: GitRunner>(
    runner: &R,
    path: &Path,
    kind: SyncKind,
) -> Result<Option<String>, RunError> {
    if let Some(op) = operation::detect(&git_dir(runner, path).await?) {
        return Ok(Some(format!("{op:?} in progress")));
    }
    if matches!(kind, SyncKind::Sync) && !runner.run(path, head::SYMBOLIC_ARGS).await?.ok() {
        return Ok(Some("detached HEAD".into()));
    }
    Ok(None)
}

fn failed(e: RunError) -> SyncOutcome {
    SyncOutcome::Failed {
        message: e.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gitcore::GitOutput;
    use std::sync::Mutex;

    struct Fake {
        track: &'static str,
        pull: (i32, &'static str),
        calls: Mutex<Vec<String>>,
    }

    impl Fake {
        fn new(track: &'static str, pull: (i32, &'static str)) -> Self {
            Self { track, pull, calls: Mutex::default() }
        }

        fn commands(&self) -> Vec<String> {
            let wanted = ["fetch", "pull", "push"];
            self.calls.lock().unwrap().iter().filter(|c| wanted.contains(&c.as_str())).cloned().collect()
        }
    }

    impl GitRunner for Fake {
        async fn run(&self, _cwd: &Path, args: &[&str]) -> Result<GitOutput, RunError> {
            let cmd = *args.iter().find(|a| !a.starts_with('-') && !a.contains('=')).unwrap();
            self.calls.lock().unwrap().push(cmd.to_string());
            let (code, out) = match cmd {
                "rev-parse" if args.contains(&"--absolute-git-dir") => (0, "/nonexistent/.git"),
                "rev-parse" => (0, "abc"),
                "symbolic-ref" => (0, "refs/heads/main"),
                "for-each-ref" => (0, self.track),
                "pull" => self.pull,
                _ => (0, ""),
            };
            Ok(GitOutput { stdout: out.as_bytes().to_vec(), stderr: Vec::new(), code })
        }
    }

    const BEHIND_AND_AHEAD: &str = "::ahead 1, behind 2::refs/remotes/origin/main";

    #[tokio::test]
    async fn sync_rebases_then_pushes() {
        let git = Fake::new(BEHIND_AND_AHEAD, (0, ""));
        assert_eq!(run(&git, Path::new("."), SyncKind::Sync).await, SyncOutcome::Done);
        assert_eq!(git.commands(), ["fetch", "pull", "push"]);
    }

    #[tokio::test]
    async fn sync_stops_before_push_on_conflict() {
        let git = Fake::new(BEHIND_AND_AHEAD, (1, "CONFLICT (content): Merge conflict in a"));
        assert_eq!(run(&git, Path::new("."), SyncKind::Sync).await, SyncOutcome::Conflict);
        assert_eq!(git.commands(), ["fetch", "pull"]);
    }

    #[tokio::test]
    async fn sync_without_upstream_only_fetches() {
        let git = Fake::new("::::", (0, ""));
        assert!(matches!(run(&git, Path::new("."), SyncKind::Sync).await, SyncOutcome::Skipped { .. }));
        assert_eq!(git.commands(), ["fetch"]);
    }
}
