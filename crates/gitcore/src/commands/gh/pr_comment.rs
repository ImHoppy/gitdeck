use super::{attach_args, repo_flag, BODY_FROM_STDIN};
use crate::commands::remote::GithubRepo;

/// The body goes on stdin.
pub fn args(repo: &GithubRepo, number: u64, attach: &[String]) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "comment".into(), number.to_string()];
    a.extend(repo_flag(repo));
    a.extend(BODY_FROM_STDIN.map(String::from));
    a.extend(attach_args(attach));
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn body_from_stdin_and_pictures() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        assert_eq!(args(&repo, 3, &[]), ["pr", "comment", "3", "-R", "a/b", "--body-file", "-"]);
        assert_eq!(args(&repo, 3, &["x.png".into()])[7..], ["--attach", "x.png"]);
    }
}
