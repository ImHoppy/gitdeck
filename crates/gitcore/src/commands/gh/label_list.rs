//! The repo's labels, for the PR list's label filter.

use super::repo_flag;
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

/// GitHub's own label picker stops scrolling well before this.
const LIMIT: &str = "500";

pub fn args(repo: &GithubRepo) -> Vec<String> {
    let mut args: Vec<String> = ["label", "list", "--json", "name,color,description", "--sort", "name", "--limit", LIMIT].map(String::from).into();
    args.extend(repo_flag(repo));
    args
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RepoLabel {
    pub name: String,
    #[serde(default)]
    pub color: String,
    #[serde(default)]
    pub description: String,
}

pub fn parse(out: &[u8]) -> Result<Vec<RepoLabel>, serde_json::Error> {
    serde_json::from_slice(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_labels() {
        let labels = parse(include_bytes!("testdata/label_list.json")).unwrap();
        assert_eq!(labels.len(), 6);
        assert_eq!(labels[3], RepoLabel { name: "attachments".into(), color: "b2fa88".into(), description: "Issues regarding `--attach`".into() });
        assert_eq!(labels[0].description, "");
    }

    #[test]
    fn names_the_repo() {
        let args = args(&GithubRepo { owner: "a".into(), name: "b".into() });
        assert_eq!(args[..2], ["label", "list"]);
        assert_eq!(args[args.len() - 2..], ["-R", "a/b"]);
    }
}
