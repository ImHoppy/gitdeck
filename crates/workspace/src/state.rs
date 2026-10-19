use gitcore::{
    commands::{ahead_behind, head, operation, status},
    model::{Head, Operation, StatusCounts, Tracking},
    GitRunner, RunError,
};
use serde::Serialize;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize)]
pub struct RepoState {
    pub head: Head,
    pub tracking: Tracking,
    pub status: StatusCounts,
    pub operation: Option<Operation>,
}

pub async fn load<R: GitRunner>(runner: &R, path: &Path) -> Result<RepoState, RunError> {
    let gitdir_fut = git_dir(runner, path);
    let symbolic_fut = runner.run(path, head::SYMBOLIC_ARGS);
    let sha_fut = runner.run(path, head::SHA_ARGS);
    let status_fut = runner.run_ok(path, status::ARGS);
    let (gitdir, symbolic, sha, status_out) =
        futures::try_join!(gitdir_fut, symbolic_fut, sha_fut, status_fut)?;

    let head = head::parse(
        symbolic.ok().then_some(&symbolic.stdout[..]),
        sha.ok().then_some(&sha.stdout[..]),
    );
    let tracking = match &head {
        Head::Branch { name } => {
            let args = ahead_behind::args(name);
            let args: Vec<&str> = args.iter().map(String::as_str).collect();
            ahead_behind::parse(&runner.run_ok(path, &args).await?)
        }
        _ => Tracking::default(),
    };
    Ok(RepoState {
        head,
        tracking,
        status: status::parse(&status_out),
        operation: operation::detect(&gitdir),
    })
}

async fn git_dir<R: GitRunner>(runner: &R, path: &Path) -> Result<PathBuf, RunError> {
    let out = runner.run_ok(path, &["rev-parse", "--absolute-git-dir"]).await?;
    Ok(PathBuf::from(String::from_utf8_lossy(&out).trim()))
}
