//! The PR list, one page at a time with GraphQL: GitHub hands back a cursor, so the next page
//! starts where the last one ended. (`gh pr list` only takes a total, so page 3 would rebuild
//! the first 300 PRs.) Pages are small enough to show while the rest still loads. "Mine",
//! "Review requested" and label filters are GitHub searches, so they find old PRs and not only
//! the latest page.

use super::{checks, graphql, login, pr_query::Query, pr_view::Label, Actor};
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};
use serde_json::json;

const REPO_QUERY: &str = concat!(include_str!("pr_list.graphql"), include_str!("pr_fields.graphql"));
const SEARCH_QUERY: &str = concat!(include_str!("pr_search.graphql"), include_str!("pr_fields.graphql"));

/// One page of the list as shown.
pub const PAGE: u32 = 100;
/// The pages stop here: a repo with more PRs in one state is searched on GitHub.
pub const MAX_LIMIT: u32 = 1000;

pub const ARGS: &[&str] = graphql::ARGS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ListState {
    Open,
    /// Closed or merged, as gh and GitHub's own "Closed" filter mean it.
    Closed,
    Merged,
}

impl ListState {
    fn github_states(self) -> &'static [&'static str] {
        match self {
            Self::Open => &["OPEN"],
            Self::Closed => &["CLOSED", "MERGED"],
            Self::Merged => &["MERGED"],
        }
    }

    pub(crate) fn qualifier(self) -> &'static str {
        match self {
            Self::Open => "is:open",
            Self::Closed => "is:closed",
            Self::Merged => "is:merged",
        }
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    #[default]
    All,
    /// Opened by the gh login.
    Mine,
    /// Waiting for the gh login's review, directly or through one of its teams.
    Review,
}

/// The request body (sent on stdin): `first` PRs after `cursor`, in the query's order.
pub fn request(repo: &GithubRepo, query: &Query, first: u32, cursor: Option<&str>) -> Vec<u8> {
    let body = if query.needs_search() {
        json!({
            "query": SEARCH_QUERY,
            "variables": { "q": query.search(repo), "first": first, "after": cursor },
        })
    } else {
        json!({
            "query": REPO_QUERY,
            "variables": { "owner": repo.owner, "name": repo.name, "states": query.state.github_states(), "orderBy": query.order_by(), "first": first, "after": cursor },
        })
    };
    serde_json::to_vec(&body).unwrap_or_default()
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
    pub created_at: String,
    pub updated_at: String,
    pub is_cross_repository: bool,
    pub head_owner: Option<String>,
    pub url: String,
    /// Logins and team names asked to review.
    pub review_requests: Vec<String>,
    pub labels: Vec<Label>,
    pub comments: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Page {
    pub prs: Vec<PrSummary>,
    /// Where the next page starts; None at the end.
    pub next: Option<String>,
}

#[derive(Deserialize)]
struct Answer {
    data: Option<Data>,
    #[serde(default)]
    errors: Vec<Message>,
}

#[derive(Deserialize)]
struct Message {
    message: String,
}

#[derive(Deserialize)]
struct Data {
    #[serde(default)]
    repository: Option<Repository>,
    #[serde(default)]
    search: Option<Connection>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Repository {
    pull_requests: Connection,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Connection {
    page_info: PageInfo,
    nodes: Vec<Raw>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageInfo {
    has_next_page: bool,
    end_cursor: Option<String>,
}

#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
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
    created_at: String,
    updated_at: String,
    #[serde(default)]
    is_cross_repository: bool,
    #[serde(default)]
    head_repository_owner: Option<Actor>,
    url: String,
    #[serde(default)]
    review_requests: Option<Nodes<RequestNode>>,
    #[serde(default)]
    commits: Option<Nodes<CommitNode>>,
    #[serde(default)]
    labels: Option<Nodes<Label>>,
    #[serde(default)]
    comments: Option<Count>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Count {
    total_count: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RequestNode {
    requested_reviewer: Option<ReviewRequest>,
}

/// A login, or a team's name.
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

#[derive(Deserialize)]
struct CommitNode {
    commit: CommitChecks,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CommitChecks {
    status_check_rollup: Option<Rollup>,
}

#[derive(Deserialize)]
struct Rollup {
    contexts: checks::Counts,
}

/// One page as GitHub sent it; a GraphQL error (a missing repo, a rate limit) is the error.
pub fn parse(out: &[u8]) -> Result<Page, String> {
    let answer: Answer = serde_json::from_slice(out).map_err(|e| e.to_string())?;
    if !answer.errors.is_empty() {
        return Err(answer.errors.into_iter().map(|e| e.message).collect::<Vec<_>>().join("; "));
    }
    let data = answer.data.ok_or("no answer")?;
    let conn = match (data.search, data.repository) {
        (Some(found), _) => found,
        (None, Some(repo)) => repo.pull_requests,
        (None, None) => return Err("repository not found".into()),
    };
    let prs = conn
        .nodes
        .into_iter()
        .map(|r| {
            let rollup = r.commits.and_then(|c| c.nodes.into_iter().next()).and_then(|c| c.commit.status_check_rollup);
            PrSummary {
                number: r.number,
                title: r.title,
                author: login(r.author),
                head_ref_name: r.head_ref_name,
                base_ref_name: r.base_ref_name,
                head_ref_oid: r.head_ref_oid,
                is_draft: r.is_draft,
                state: r.state,
                review_decision: r.review_decision.filter(|d| !d.is_empty()),
                checks: rollup.map(|r| r.contexts.summary()).unwrap_or_default(),
                created_at: r.created_at,
                updated_at: r.updated_at,
                is_cross_repository: r.is_cross_repository,
                head_owner: r.head_repository_owner.map(|o| o.login),
                url: r.url,
                review_requests: r
                    .review_requests
                    .map(|n| n.nodes.into_iter().filter_map(|q| q.requested_reviewer.and_then(ReviewRequest::who)).collect())
                    .unwrap_or_default(),
                labels: r.labels.map(|n| n.nodes).unwrap_or_default(),
                comments: r.comments.map_or(0, |c| c.total_count),
            }
        })
        .collect();
    let next = conn.page_info.end_cursor.filter(|_| conn.page_info.has_next_page);
    Ok(Page { prs, next })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_page_of_closed_and_merged() {
        let page = parse(include_bytes!("testdata/pr_list.json")).unwrap();
        assert_eq!(page.prs.len(), 5);
        assert!(page.next.is_some());
        assert_eq!(page.prs[0].number, 6947);
        assert_eq!(page.prs[0].state, "CLOSED");
        assert_eq!(page.prs[3].state, "MERGED");
        assert!(page.prs.iter().all(|p| p.url.starts_with("https://github.com/boykopovar/AnyPS5/pull/")));
        assert!(page.prs.iter().any(|p| p.checks.passed + p.checks.failed + p.checks.pending > 0));
    }

    #[test]
    fn request_asks_both_states_for_closed() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        let query = Query { state: ListState::Closed, ..Query::open() };
        let body: serde_json::Value = serde_json::from_slice(&request(&repo, &query, 25, Some("c1"))).unwrap();
        assert_eq!(body["variables"]["states"], json!(["CLOSED", "MERGED"]));
        assert_eq!(body["variables"]["orderBy"]["field"], "UPDATED_AT");
        assert_eq!(body["variables"]["after"], "c1");
        assert_eq!(body["variables"]["first"], 25);
        assert!(body["query"].as_str().unwrap().contains("pullRequests(states: $states"));
        assert!(body["query"].as_str().unwrap().contains("fragment Pr on PullRequest"));
    }

    #[test]
    fn mine_and_review_are_searches() {
        let repo = GithubRepo { owner: "a".into(), name: "b".into() };
        let query = Query { state: ListState::Closed, scope: Scope::Mine, ..Query::open() };
        let body: serde_json::Value = serde_json::from_slice(&request(&repo, &query, 25, None)).unwrap();
        assert_eq!(body["variables"]["q"], "repo:a/b is:pr is:closed author:@me sort:updated-desc");
        assert!(body["query"].as_str().unwrap().contains("search(query: $q, type: ISSUE"));
        let query = Query { scope: Scope::Review, ..Query::open() };
        let body: serde_json::Value = serde_json::from_slice(&request(&repo, &query, 25, None)).unwrap();
        assert_eq!(body["variables"]["q"], "repo:a/b is:pr is:open review-requested:@me sort:updated-desc");
    }

    #[test]
    fn real_search_page() {
        let page = parse(include_bytes!("testdata/pr_search.json")).unwrap();
        assert_eq!(page.prs.len(), 3);
        assert!(page.prs.iter().all(|p| p.author == "babakks" && p.state == "MERGED"));
        assert!(page.next.is_some());
    }

    #[test]
    fn last_page_errors_and_teams() {
        let out = br#"{"data":{"repository":{"pullRequests":{"pageInfo":{"hasNextPage":false,"endCursor":"x"},"nodes":[
            {"number":1,"title":"t","author":null,"headRefName":"h","baseRefName":"main","isDraft":true,"state":"OPEN",
             "reviewDecision":null,"updatedAt":"2026-01-01T00:00:00Z","url":"u","headRepositoryOwner":null,
             "reviewRequests":{"nodes":[{"requestedReviewer":{"name":"core"}},{"requestedReviewer":{"login":"me"}},{"requestedReviewer":null}]},
             "commits":{"nodes":[{"commit":{"statusCheckRollup":null}}]},
             "labels":{"nodes":[{"name":"bug","color":"d73a4a"}]},"comments":{"totalCount":4}}]}}}}"#;
        let page = parse(out).unwrap();
        assert_eq!(page.next, None);
        assert_eq!(page.prs[0].author, "ghost");
        assert_eq!(page.prs[0].review_requests, ["core", "me"]);
        assert_eq!(page.prs[0].labels[0].name, "bug");
        assert_eq!(page.prs[0].comments, 4);
        assert_eq!(parse(br#"{"data":null,"errors":[{"message":"API rate limit exceeded"}]}"#), Err("API rate limit exceeded".into()));
        assert_eq!(parse(br#"{"data":{"repository":null}}"#), Err("repository not found".into()));
    }
}
