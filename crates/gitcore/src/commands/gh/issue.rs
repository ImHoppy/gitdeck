//! What `#123` points at: GitHub numbers issues and PRs in one sequence, so the type is asked
//! once per reference (the issues endpoint answers for both).

use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

const CARD: &str = "{number, title, state, author: .user.login, isPull: (.pull_request != null), \
merged: (.pull_request.merged_at != null), draft: (.draft // false), url: .html_url}";

pub fn card_args(repo: &GithubRepo, number: u64) -> Vec<String> {
    vec!["api".into(), format!("repos/{}/issues/{number}", repo.slug()), "--jq".into(), CARD.into()]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RefCard {
    pub number: u64,
    pub title: String,
    /// `open` or `closed`.
    pub state: String,
    #[serde(default)]
    pub author: String,
    pub is_pull: bool,
    pub merged: bool,
    pub draft: bool,
    pub url: String,
}

pub fn parse(out: &[u8]) -> Result<RefCard, serde_json::Error> {
    serde_json::from_slice(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pull_requests_and_issues() {
        let pr = parse(include_bytes!("testdata/card_pr.json")).unwrap();
        assert!(pr.is_pull && pr.merged);
        assert_eq!(pr.number, 14752);
        let issue = parse(include_bytes!("testdata/card_issue.json")).unwrap();
        assert!(!issue.is_pull);
        assert_eq!(issue.state, "open");
    }
}
