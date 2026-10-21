use super::{attach_args, repo_flag, BODY_FROM_STDIN};
use crate::commands::remote::GithubRepo;
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewPr {
    pub title: String,
    pub body: String,
    pub base: String,
    pub head: String,
    #[serde(default)]
    pub draft: bool,
}

/// The body goes on stdin; `attach` are `file#alt` paths uploaded by gh.
pub fn args(repo: &GithubRepo, pr: &NewPr, attach: &[String]) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "create".into()];
    a.extend(repo_flag(repo));
    a.extend(["--title".into(), pr.title.clone(), "--base".into(), pr.base.clone(), "--head".into(), pr.head.clone()]);
    a.extend(BODY_FROM_STDIN.map(String::from));
    if pr.draft {
        a.push("--draft".into());
    }
    a.extend(attach_args(attach));
    a
}

/// gh prints the new PR's URL, `https://github.com/o/r/pull/12`.
pub fn parse_number(out: &[u8]) -> Option<u64> {
    let text = String::from_utf8_lossy(out);
    let line = text.lines().map(str::trim).rfind(|l| l.contains("/pull/"))?;
    line.rsplit('/').next()?.parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_args_and_reads_the_url() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        let pr = NewPr { title: "Fix".into(), body: String::new(), base: "main".into(), head: "feat".into(), draft: true };
        let a = args(&repo, &pr, &["./shot.png#Before".into()]);
        assert_eq!(
            a,
            [
                "pr", "create", "-R", "a/b", "--title", "Fix", "--base", "main", "--head", "feat", "--body-file", "-", "--draft",
                "--attach", "./shot.png#Before"
            ]
        );
        assert_eq!(parse_number(b"\nCreating pull request for feat into main in a/b\n\nhttps://github.com/a/b/pull/12\n"), Some(12));
        assert_eq!(parse_number(b"nothing"), None);
    }
}
