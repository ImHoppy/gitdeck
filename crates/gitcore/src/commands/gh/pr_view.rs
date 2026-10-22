use super::{checks, login, pr_list::ReviewRequest, repo_flag, Actor};
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

const FIELDS: &str = "id,number,title,body,author,state,isDraft,url,createdAt,updatedAt,headRefName,baseRefName,\
headRefOid,baseRefOid,headRepository,headRepositoryOwner,isCrossRepository,maintainerCanModify,mergeable,\
mergeStateStatus,reviewDecision,statusCheckRollup,commits,files,additions,deletions,labels,reviewRequests,mergedAt";

pub fn args(repo: &GithubRepo, number: u64) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "view".into(), number.to_string()];
    a.extend(repo_flag(repo));
    a.extend(["--json".into(), FIELDS.into()]);
    a
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrDetail {
    /// The GraphQL node id, which reviews and replies are sent to.
    pub id: String,
    pub number: u64,
    pub title: String,
    pub body: String,
    pub author: String,
    pub state: String,
    pub is_draft: bool,
    pub url: String,
    pub created_at: String,
    pub updated_at: String,
    pub head_ref_name: String,
    pub base_ref_name: String,
    pub head_ref_oid: String,
    pub base_ref_oid: String,
    /// Where the head branch lives: this repo, or the fork it comes from.
    pub head_repo: Option<GithubRepo>,
    pub is_cross_repository: bool,
    pub maintainer_can_modify: bool,
    /// `MERGEABLE`, `CONFLICTING` or `UNKNOWN` (GitHub is still computing it).
    pub mergeable: String,
    /// `CLEAN`, `BLOCKED`, `BEHIND`, `DIRTY`, `UNSTABLE`, `DRAFT`, `HAS_HOOKS` or `UNKNOWN`.
    pub merge_state_status: String,
    pub review_decision: Option<String>,
    pub checks: checks::CheckSummary,
    pub commits: Vec<PrCommit>,
    pub files: Vec<PrFile>,
    pub additions: u64,
    pub deletions: u64,
    pub labels: Vec<Label>,
    pub review_requests: Vec<String>,
    pub merged_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PrCommit {
    pub oid: String,
    pub headline: String,
    pub authored_date: String,
    pub author: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrFile {
    pub path: String,
    pub additions: u64,
    pub deletions: u64,
    #[serde(default)]
    pub change_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Label {
    pub name: String,
    #[serde(default)]
    pub color: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Raw {
    id: String,
    number: u64,
    title: String,
    #[serde(default)]
    body: String,
    author: Option<Actor>,
    state: String,
    is_draft: bool,
    url: String,
    created_at: String,
    updated_at: String,
    head_ref_name: String,
    base_ref_name: String,
    #[serde(default)]
    head_ref_oid: String,
    #[serde(default)]
    base_ref_oid: String,
    #[serde(default)]
    head_repository: Option<HeadRepository>,
    #[serde(default)]
    head_repository_owner: Option<Actor>,
    #[serde(default)]
    is_cross_repository: bool,
    #[serde(default)]
    maintainer_can_modify: bool,
    #[serde(default)]
    mergeable: String,
    #[serde(default)]
    merge_state_status: String,
    #[serde(default)]
    review_decision: Option<String>,
    #[serde(default)]
    status_check_rollup: Vec<checks::RollupItem>,
    #[serde(default)]
    commits: Vec<RawCommit>,
    #[serde(default)]
    files: Vec<PrFile>,
    #[serde(default)]
    additions: u64,
    #[serde(default)]
    deletions: u64,
    #[serde(default)]
    labels: Vec<Label>,
    #[serde(default)]
    review_requests: Vec<ReviewRequest>,
    #[serde(default)]
    merged_at: Option<String>,
}

#[derive(Deserialize)]
struct HeadRepository {
    name: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCommit {
    oid: String,
    message_headline: String,
    authored_date: String,
    #[serde(default)]
    authors: Vec<CommitAuthor>,
}

#[derive(Deserialize)]
struct CommitAuthor {
    #[serde(default)]
    login: String,
    #[serde(default)]
    name: String,
}

pub fn parse(out: &[u8]) -> Result<PrDetail, serde_json::Error> {
    let r: Raw = serde_json::from_slice(out)?;
    let owner = r.head_repository_owner.map(|o| o.login);
    let head_repo = match (owner, r.head_repository) {
        (Some(owner), Some(repo)) => Some(GithubRepo { owner, name: repo.name }),
        _ => None,
    };
    Ok(PrDetail {
        id: r.id,
        number: r.number,
        title: r.title,
        body: r.body,
        author: login(r.author),
        state: r.state,
        is_draft: r.is_draft,
        url: r.url,
        created_at: r.created_at,
        updated_at: r.updated_at,
        head_ref_name: r.head_ref_name,
        base_ref_name: r.base_ref_name,
        head_ref_oid: r.head_ref_oid,
        base_ref_oid: r.base_ref_oid,
        head_repo,
        is_cross_repository: r.is_cross_repository,
        maintainer_can_modify: r.maintainer_can_modify,
        mergeable: r.mergeable,
        merge_state_status: r.merge_state_status,
        review_decision: r.review_decision.filter(|d| !d.is_empty()),
        checks: checks::summarize(&r.status_check_rollup),
        commits: r
            .commits
            .into_iter()
            .map(|c| PrCommit {
                oid: c.oid,
                headline: c.message_headline,
                authored_date: c.authored_date,
                author: c.authors.into_iter().next().map(|a| if a.login.is_empty() { a.name } else { a.login }).unwrap_or_default(),
            })
            .collect(),
        files: r.files,
        additions: r.additions,
        deletions: r.deletions,
        labels: r.labels,
        review_requests: r.review_requests.into_iter().filter_map(ReviewRequest::who).collect(),
        merged_at: r.merged_at.filter(|m| !m.is_empty()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_view() {
        let pr = parse(include_bytes!("testdata/pr_view.json")).unwrap();
        assert_eq!(pr.number, 14752);
        assert_eq!(pr.state, "MERGED");
        assert!(pr.body.starts_with("### Description"));
        assert_eq!(pr.head_repo.as_ref().map(GithubRepo::slug).as_deref(), Some("cli/cli"));
        assert_eq!(pr.commits.len(), 8);
        assert_eq!(pr.commits[0].author, "babakks");
        assert_eq!(pr.files.len(), 15);
        assert_eq!(pr.files[0].path, ".github/workflows/go.yml");
        assert_eq!(pr.review_requests, ["williammartin"]);
        assert!(pr.merged_at.is_some());
        assert!(pr.id.starts_with("PR_"));
    }
}
