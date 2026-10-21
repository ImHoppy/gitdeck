use super::repo_flag;
use crate::commands::remote::GithubRepo;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum StateChange {
    Close,
    Reopen,
    Ready,
    /// Back to draft.
    Draft,
    /// Rebases the PR branch onto its base on GitHub, for a branch not checked out here.
    UpdateBranch,
}

pub fn args(repo: &GithubRepo, number: u64, change: StateChange) -> Vec<String> {
    let sub: &[&str] = match change {
        StateChange::Close => &["close"],
        StateChange::Reopen => &["reopen"],
        StateChange::Ready => &["ready"],
        StateChange::Draft => &["ready", "--undo"],
        StateChange::UpdateBranch => &["update-branch", "--rebase"],
    };
    let mut a = vec!["pr".to_string(), sub[0].into(), number.to_string()];
    a.extend(sub[1..].iter().map(|s| s.to_string()));
    a.extend(repo_flag(repo));
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn each_change() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        assert_eq!(args(&repo, 2, StateChange::Draft), ["pr", "ready", "2", "--undo", "-R", "a/b"]);
        assert_eq!(args(&repo, 2, StateChange::UpdateBranch), ["pr", "update-branch", "2", "--rebase", "-R", "a/b"]);
        assert_eq!(args(&repo, 2, StateChange::Close), ["pr", "close", "2", "-R", "a/b"]);
    }
}
