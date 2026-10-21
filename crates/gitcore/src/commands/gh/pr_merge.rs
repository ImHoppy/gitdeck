use super::repo_flag;
use crate::commands::remote::GithubRepo;
use serde::Deserialize;

/// No merge-commit method: history stays linear.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MergeMethod {
    Rebase,
    Squash,
}

/// Refused by GitHub when the head moved since `head_sha`, so what was reviewed is what lands.
/// gitdeck deletes the branch itself afterwards: gh's `--delete-branch` would also switch the
/// local checkout behind the write queue's back.
pub fn args(repo: &GithubRepo, number: u64, method: MergeMethod, head_sha: &str) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "merge".into(), number.to_string()];
    a.extend(repo_flag(repo));
    a.push(match method {
        MergeMethod::Rebase => "--rebase".into(),
        MergeMethod::Squash => "--squash".into(),
    });
    a.extend(["--match-head-commit".into(), head_sha.into()]);
    a
}

/// A squash with its commit message written by the user: the subject as an argument, the body
/// on stdin.
pub fn squash_args(repo: &GithubRepo, number: u64, head_sha: &str, subject: &str) -> Vec<String> {
    let mut a = args(repo, number, MergeMethod::Squash, head_sha);
    a.extend(["--subject".into(), subject.into()]);
    a.extend(super::BODY_FROM_STDIN.map(String::from));
    a
}

pub fn delete_remote_branch_args(repo: &GithubRepo, branch: &str) -> Vec<String> {
    vec!["api".into(), "-X".into(), "DELETE".into(), format!("repos/{}/git/refs/heads/{branch}", repo.slug())]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rebase_or_squash_only_and_pinned_to_the_head() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        assert_eq!(
            args(&repo, 7, MergeMethod::Squash, "abc"),
            ["pr", "merge", "7", "-R", "a/b", "--squash", "--match-head-commit", "abc"]
        );
        assert_eq!(squash_args(&repo, 7, "abc", "Fix (#7)")[8..], ["--subject", "Fix (#7)", "--body-file", "-"]);
        assert_eq!(delete_remote_branch_args(&repo, "feat/x")[3], "repos/a/b/git/refs/heads/feat/x");
    }
}
