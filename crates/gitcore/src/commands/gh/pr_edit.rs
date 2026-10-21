use super::{attach_args, repo_flag, BODY_FROM_STDIN};
use crate::commands::remote::GithubRepo;

/// A new title and body (on stdin) for the PR.
pub fn args(repo: &GithubRepo, number: u64, title: &str, attach: &[String]) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "edit".into(), number.to_string()];
    a.extend(repo_flag(repo));
    a.extend(["--title".into(), title.into()]);
    a.extend(BODY_FROM_STDIN.map(String::from));
    a.extend(attach_args(attach));
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn edits_title_and_body() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        assert_eq!(args(&repo, 3, "New", &[]), ["pr", "edit", "3", "-R", "a/b", "--title", "New", "--body-file", "-"]);
    }
}
