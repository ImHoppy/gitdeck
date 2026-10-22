//! The Conversation tab in one paginated GraphQL query: `gh pr view --json` has no inline threads.

use super::{camo, login, Actor};
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const QUERY: &str = include_str!("timeline.graphql");

/// `-f` keeps owner and name strings even when they look like numbers; `-F` makes `number` an Int.
pub fn args(repo: &GithubRepo, number: u64) -> Vec<String> {
    let mut a: Vec<String> = ["api", "graphql", "--paginate", "--slurp"].map(String::from).to_vec();
    a.extend(["-f".into(), format!("owner={}", repo.owner), "-f".into(), format!("name={}", repo.name)]);
    a.extend(["-F".into(), format!("number={number}"), "-f".into(), format!("query={QUERY}")]);
    a
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Timeline {
    pub viewer: String,
    pub pr_id: String,
    pub viewer_can_update: bool,
    pub items: Vec<TimelineItem>,
    pub threads: Vec<ReviewThread>,
    /// Pictures hosted outside GitHub: original URL → GitHub's camo copy.
    pub images: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Comment {
    pub id: String,
    pub author: String,
    pub body: String,
    pub created_at: String,
    pub updated_at: String,
    pub can_edit: bool,
    pub can_delete: bool,
    pub reactions: Vec<Reaction>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Reaction {
    pub content: String,
    pub count: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Review {
    #[serde(flatten)]
    pub comment: Comment,
    /// `APPROVED`, `CHANGES_REQUESTED`, `COMMENTED`, `DISMISSED` or `PENDING`.
    pub state: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Event {
    /// `merged`, `closed`, `reopened`, `ready` or `draft`.
    pub event: &'static str,
    pub actor: String,
    pub at: String,
    pub commit: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum TimelineItem {
    Comment(Comment),
    Review(Review),
    Commit { oid: String, headline: String, author: String, at: String },
    ForcePushed { actor: String, at: String, before: Option<String>, after: Option<String> },
    Event(Event),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReviewThread {
    pub id: String,
    pub resolved: bool,
    pub outdated: bool,
    pub path: String,
    pub line: Option<u32>,
    pub original_line: Option<u32>,
    pub start_line: Option<u32>,
    /// `LEFT` (old side) or `RIGHT` (new side).
    pub side: String,
    pub can_resolve: bool,
    pub can_unresolve: bool,
    pub can_reply: bool,
    /// The review the thread was opened in, to show it under that review.
    pub review_id: Option<String>,
    pub diff_hunk: String,
    pub comments: Vec<Comment>,
}

#[derive(Deserialize)]
struct Page {
    data: Data,
}

#[derive(Deserialize)]
struct Data {
    viewer: Actor,
    repository: Repository,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Repository {
    pull_request: RawPr,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawPr {
    id: String,
    #[serde(default)]
    viewer_can_update: bool,
    #[serde(default, rename = "bodyHTML")]
    body_html: String,
    review_threads: Nodes<RawThread>,
    timeline_items: Nodes<RawItem>,
}

#[derive(Deserialize)]
struct Nodes<T> {
    nodes: Vec<T>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawComment {
    id: String,
    #[serde(default)]
    body: String,
    #[serde(default, rename = "bodyHTML")]
    body_html: String,
    #[serde(default)]
    created_at: String,
    #[serde(default)]
    updated_at: String,
    #[serde(default)]
    viewer_can_update: bool,
    #[serde(default)]
    viewer_can_delete: bool,
    author: Option<Actor>,
    #[serde(default)]
    reaction_groups: Vec<ReactionGroup>,
    #[serde(default)]
    diff_hunk: String,
    #[serde(default)]
    pull_request_review: Option<Id>,
    #[serde(default)]
    state: String,
    #[serde(default)]
    submitted_at: Option<String>,
}

#[derive(Deserialize)]
struct Id {
    id: String,
}

#[derive(Deserialize)]
struct ReactionGroup {
    content: String,
    reactors: Count,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Count {
    total_count: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawThread {
    id: String,
    is_resolved: bool,
    #[serde(default)]
    is_outdated: bool,
    path: String,
    line: Option<u32>,
    original_line: Option<u32>,
    start_line: Option<u32>,
    #[serde(default)]
    diff_side: String,
    #[serde(default)]
    viewer_can_resolve: bool,
    #[serde(default)]
    viewer_can_unresolve: bool,
    #[serde(default)]
    viewer_can_reply: bool,
    comments: Nodes<RawComment>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawCommit {
    oid: String,
    message_headline: String,
    authored_date: String,
    author: Option<GitActor>,
}

#[derive(Deserialize)]
struct GitActor {
    #[serde(default)]
    name: String,
    user: Option<Actor>,
}

#[derive(Deserialize)]
struct Oid {
    oid: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawEvent {
    created_at: String,
    actor: Option<Actor>,
    #[serde(default)]
    commit: Option<Oid>,
    #[serde(default)]
    before_commit: Option<Oid>,
    #[serde(default)]
    after_commit: Option<Oid>,
}

#[derive(Deserialize)]
#[serde(tag = "__typename")]
enum RawItem {
    IssueComment(RawComment),
    PullRequestReview(RawComment),
    PullRequestCommit { commit: RawCommit },
    HeadRefForcePushedEvent(RawEvent),
    MergedEvent(RawEvent),
    ClosedEvent(RawEvent),
    ReopenedEvent(RawEvent),
    ReadyForReviewEvent(RawEvent),
    ConvertToDraftEvent(RawEvent),
    #[serde(other)]
    Other,
}

impl RawComment {
    fn into_comment(self) -> Comment {
        Comment {
            id: self.id,
            author: login(self.author),
            body: self.body,
            created_at: self.submitted_at.unwrap_or(self.created_at),
            updated_at: self.updated_at,
            can_edit: self.viewer_can_update,
            can_delete: self.viewer_can_delete,
            reactions: self
                .reaction_groups
                .into_iter()
                .filter(|g| g.reactors.total_count > 0)
                .map(|g| Reaction { content: g.content, count: g.reactors.total_count })
                .collect(),
        }
    }
}

fn event(name: &'static str, e: RawEvent) -> TimelineItem {
    TimelineItem::Event(Event { event: name, actor: login(e.actor), at: e.created_at, commit: e.commit.map(|c| c.oid) })
}

impl RawItem {
    fn into_item(self) -> Option<TimelineItem> {
        Some(match self {
            Self::IssueComment(c) => TimelineItem::Comment(c.into_comment()),
            Self::PullRequestReview(c) => {
                let state = c.state.clone();
                TimelineItem::Review(Review { comment: c.into_comment(), state })
            }
            Self::PullRequestCommit { commit } => TimelineItem::Commit {
                oid: commit.oid,
                headline: commit.message_headline,
                author: commit.author.map(|a| a.user.map(|u| login(Some(u))).unwrap_or(a.name)).unwrap_or_default(),
                at: commit.authored_date,
            },
            Self::HeadRefForcePushedEvent(e) => TimelineItem::ForcePushed {
                actor: login(e.actor),
                at: e.created_at,
                before: e.before_commit.map(|c| c.oid),
                after: e.after_commit.map(|c| c.oid),
            },
            Self::MergedEvent(e) => event("merged", e),
            Self::ClosedEvent(e) => event("closed", e),
            Self::ReopenedEvent(e) => event("reopened", e),
            Self::ReadyForReviewEvent(e) => event("ready", e),
            Self::ConvertToDraftEvent(e) => event("draft", e),
            Self::Other => return None,
        })
    }
}

impl RawThread {
    fn into_thread(self) -> ReviewThread {
        let first = self.comments.nodes.first();
        let review_id = first.and_then(|c| c.pull_request_review.as_ref()).map(|r| r.id.clone());
        let diff_hunk = first.map(|c| c.diff_hunk.clone()).unwrap_or_default();
        ReviewThread {
            id: self.id,
            resolved: self.is_resolved,
            outdated: self.is_outdated,
            path: self.path,
            line: self.line,
            original_line: self.original_line,
            start_line: self.start_line,
            side: self.diff_side,
            can_resolve: self.viewer_can_resolve,
            can_unresolve: self.viewer_can_unresolve,
            can_reply: self.viewer_can_reply,
            review_id,
            diff_hunk,
            comments: self.comments.nodes.into_iter().map(RawComment::into_comment).collect(),
        }
    }
}

/// `--slurp` wraps the pages in an array; the threads are repeated on every page.
pub fn parse(out: &[u8]) -> Result<Timeline, serde_json::Error> {
    let pages: Vec<Page> = serde_json::from_slice(out)?;
    let mut timeline =
        Timeline { viewer: String::new(), pr_id: String::new(), viewer_can_update: false, items: Vec::new(), threads: Vec::new(), images: HashMap::new() };
    for (i, page) in pages.into_iter().enumerate() {
        let pr = page.data.repository.pull_request;
        if i == 0 {
            timeline.viewer = page.data.viewer.login;
            timeline.pr_id = pr.id;
            timeline.viewer_can_update = pr.viewer_can_update;
            camo::collect(&pr.body_html, &mut timeline.images);
            for c in pr.review_threads.nodes.iter().flat_map(|t| &t.comments.nodes) {
                camo::collect(&c.body_html, &mut timeline.images);
            }
            timeline.threads = pr.review_threads.nodes.into_iter().map(RawThread::into_thread).collect();
        }
        for item in &pr.timeline_items.nodes {
            if let RawItem::IssueComment(c) | RawItem::PullRequestReview(c) = item {
                camo::collect(&c.body_html, &mut timeline.images);
            }
        }
        timeline.items.extend(pr.timeline_items.nodes.into_iter().filter_map(RawItem::into_item));
    }
    Ok(timeline)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_timeline() {
        let t = parse(include_bytes!("testdata/timeline.json")).unwrap();
        assert_eq!(t.viewer, "ImHoppy");
        assert!(t.pr_id.starts_with("PR_"));
        let reviews = t.items.iter().filter(|i| matches!(i, TimelineItem::Review(_))).count();
        let commits = t.items.iter().filter(|i| matches!(i, TimelineItem::Commit { .. })).count();
        assert!(reviews > 0 && commits > 0);
        assert!(t.items.iter().any(|i| matches!(i, TimelineItem::Event(Event { event: "merged", .. }))));
        let thread = &t.threads[0];
        assert_eq!(thread.path, "internal/debug/config_enabled_test.go");
        assert!(thread.resolved);
        assert_eq!(thread.side, "RIGHT");
        assert_eq!(thread.comments.len(), 2);
        assert!(thread.review_id.as_deref().is_some_and(|id| id.starts_with("PRR_")));
        assert!(thread.diff_hunk.starts_with("@@"));
    }

    #[test]
    fn serializes_items_with_a_kind() {
        let item = TimelineItem::Commit { oid: "a".into(), headline: "h".into(), author: "me".into(), at: "t".into() };
        assert_eq!(serde_json::to_value(&item).unwrap()["kind"], "commit");
        let t = parse(include_bytes!("testdata/timeline.json")).unwrap();
        let review = t.items.iter().find(|i| matches!(i, TimelineItem::Review(_))).unwrap();
        let v = serde_json::to_value(review).unwrap();
        assert_eq!(v["kind"], "review");
        assert!(v["state"].is_string() && v["author"].is_string());
    }
}
