use crate::RepoEntry;
use gitcore::{commands::tracked, GitRunner, RunError};
use std::path::Path;

/// The branch a detached submodule should follow: `.gitmodules` `branch =`, else the remote default.
pub async fn tracked_branch<R: GitRunner>(runner: &R, entry: &RepoEntry, parent: Option<&Path>) -> Result<Option<String>, RunError> {
    if let (Some(parent), Some(sub)) = (parent, &entry.path_in_parent) {
        let args = tracked::gitmodules_branch_args(sub);
        let args: Vec<&str> = args.iter().map(String::as_str).collect();
        let out = runner.run(parent, &args).await?;
        if out.ok() {
            if let Some(b) = tracked::branch_name(&out.stdout) {
                return Ok(Some(b));
            }
        }
    }
    let out = runner.run(&entry.path, tracked::REMOTE_HEAD_ARGS).await?;
    Ok(out.ok().then(|| tracked::branch_name(&out.stdout)).flatten())
}

/// `switch` to the branch, creating it from `origin/<branch>` when it only exists on the remote.
pub async fn checkout_args<R: GitRunner>(runner: &R, path: &Path, branch: &str) -> Result<Vec<String>, RunError> {
    let locals = runner.run_ok(path, tracked::LOCAL_BRANCHES_ARGS).await?;
    let exists = String::from_utf8_lossy(&locals).lines().any(|l| l == branch);
    Ok(if exists {
        vec!["switch".into(), branch.into()]
    } else {
        vec!["switch".into(), "-c".into(), branch.into(), "--track".into(), format!("origin/{branch}")]
    })
}
