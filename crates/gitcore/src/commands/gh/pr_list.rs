use super::{checks, login, repo_flag, Actor};
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

const FIELDS: &str = "number,title,author,headRefName,baseRefName,headRefOid,isDraft,state,reviewDecision,\
statusCheckRollup,updatedAt,isCrossRepository,headRepositoryOwner,url,reviewRequests";

pub const LIMIT: u32 = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ListState {
    Open,
    Closed,
    Merged,
}

pub fn args(repo: &GithubRepo, state: ListState) -> Vec<String> {
    let state = match state {
        ListState::Open => "open",
        ListState::Closed => "closed",
        ListState::Merged => "merged",
    };
    let mut a = vec!["pr".to_string(), "list".into()];
    a.extend(repo_flag(repo));
    a.extend(["--state".into(), state.into(), "--limit".into(), LIMIT.to_string(), "--json".into(), FIELDS.into()]);
    a
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrSummary {
    pub number: u64,
    pub title: String,
    pub author: String,
    pub head_ref_name: String,
    pub base_ref_name: String,
    pub head_ref_oid: String,
    pub is_draft: bool,
    /// `OPEN`, `CLOSED` or `MERGED`.
    pub state: String,
    /// `APPROVED`, `CHANGES_REQUESTED`, `REVIEW_REQUIRED`, or none when no review is required.
    pub review_decision: Option<String>,
    pub checks: checks::CheckSummary,
    pub updated_at: String,
    pub is_cross_repository: bool,
    pub head_owner: Option<String>,
    pub url: String,
    /// Logins and team names asked to review.
    pub review_requests: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Raw {
    number: u64,
    title: String,
    author: Option<Actor>,
    head_ref_name: String,
    base_ref_name: String,
    #[serde(default)]
    head_ref_oid: String,
    is_draft: bool,
    state: String,
    #[serde(default)]
    review_decision: Option<String>,
    #[serde(default)]
    status_check_rollup: Vec<checks::RollupItem>,
    updated_at: String,
    #[serde(default)]
    is_cross_repository: bool,
    #[serde(default)]
    head_repository_owner: Option<Actor>,
    url: String,
    #[serde(default)]
    review_requests: Vec<ReviewRequest>,
}

#[derive(Deserialize)]
pub(crate) struct ReviewRequest {
    #[serde(default)]
    login: Option<String>,
    #[serde(default)]
    name: Option<String>,
}

impl ReviewRequest {
    pub(crate) fn who(self) -> Option<String> {
        self.login.or(self.name)
    }
}

pub fn parse(out: &[u8]) -> Result<Vec<PrSummary>, serde_json::Error> {
    let raw: Vec<Raw> = serde_json::from_slice(out)?;
    Ok(raw
        .into_iter()
        .map(|r| PrSummary {
            number: r.number,
            title: r.title,
            author: login(r.author),
            head_ref_name: r.head_ref_name,
            base_ref_name: r.base_ref_name,
            head_ref_oid: r.head_ref_oid,
            is_draft: r.is_draft,
            state: r.state,
            review_decision: r.review_decision.filter(|d| !d.is_empty()),
            checks: checks::summarize(&r.status_check_rollup),
            updated_at: r.updated_at,
            is_cross_repository: r.is_cross_repository,
            head_owner: r.head_repository_owner.map(|o| o.login),
            url: r.url,
            review_requests: r.review_requests.into_iter().filter_map(ReviewRequest::who).collect(),
        })
        .collect())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_list() {
        let prs = parse(include_bytes!("testdata/pr_list.json")).unwrap();
        assert_eq!(prs.len(), 3);
        let first = &prs[0];
        assert_eq!(first.number, 14784);
        assert_eq!(first.author, "tommaso-moro");
        assert_eq!(first.base_ref_name, "trunk");
        assert_eq!(first.review_decision.as_deref(), Some("REVIEW_REQUIRED"));
        assert_eq!(first.head_owner.as_deref(), Some("cli"));
        assert!(first.checks.passed > 0);
        assert_eq!(first.head_ref_oid.len(), 40);
    }

    #[test]
    fn args_name_the_repo_and_state() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        let a = args(&repo, ListState::Merged);
        assert_eq!(&a[..6], ["pr", "list", "-R", "a/b", "--state", "merged"]);
    }

    #[test]
    fn deleted_author_and_teams() {
        let out = br#"[{"number":1,"title":"t","author":null,"headRefName":"h","baseRefName":"main","isDraft":true,
            "state":"OPEN","reviewDecision":"","updatedAt":"2026-01-01T00:00:00Z","url":"u",
            "reviewRequests":[{"__typename":"Team","name":"core"},{"__typename":"User","login":"me"}]}]"#;
        let pr = &parse(out).unwrap()[0];
        assert_eq!(pr.author, "ghost");
        assert_eq!(pr.review_decision, None);
        assert_eq!(pr.review_requests, ["core", "me"]);
    }
}
