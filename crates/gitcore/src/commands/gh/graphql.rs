//! Writes that only GraphQL offers (thread replies, edits, resolving, a review with inline
//! comments), sent as one JSON request on stdin so a long body never reaches the command line.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

pub const ARGS: &[&str] = &["api", "graphql", "--input", "-"];

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DraftThread {
    pub path: String,
    pub line: u32,
    /// `LEFT` or `RIGHT`.
    pub side: String,
    #[serde(default)]
    pub start_line: Option<u32>,
    pub body: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ReviewEvent {
    Comment,
    Approve,
    RequestChanges,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Mutation {
    Reply { thread_id: String, body: String },
    Edit { id: String, body: String },
    Delete { id: String },
    Resolve { thread_id: String },
    Unresolve { thread_id: String },
    Review { pr_id: String, event: ReviewEvent, body: String, threads: Vec<DraftThread> },
}

/// The node id's prefix tells an issue comment (`IC_`), a review comment (`PRRC_`) and a
/// review (`PRR_`) apart; each has its own mutation.
fn edit_mutation(id: &str) -> (&'static str, &'static str) {
    if id.starts_with("PRRC_") {
        ("updatePullRequestReviewComment", "pullRequestReviewCommentId")
    } else if id.starts_with("PRR_") {
        ("updatePullRequestReview", "pullRequestReviewId")
    } else {
        ("updateIssueComment", "id")
    }
}

impl Mutation {
    pub fn request(&self) -> Vec<u8> {
        let (query, variables) = match self {
            Self::Reply { thread_id, body } => (
                "mutation($id: ID!, $body: String!) { addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $id, body: $body}) { comment { id } } }".to_string(),
                json!({ "id": thread_id, "body": body }),
            ),
            Self::Edit { id, body } => {
                let (name, field) = edit_mutation(id);
                (
                    format!("mutation($id: ID!, $body: String!) {{ {name}(input: {{{field}: $id, body: $body}}) {{ clientMutationId }} }}"),
                    json!({ "id": id, "body": body }),
                )
            }
            Self::Delete { id } => {
                let name = if id.starts_with("PRRC_") { "deletePullRequestReviewComment" } else { "deleteIssueComment" };
                (format!("mutation($id: ID!) {{ {name}(input: {{id: $id}}) {{ clientMutationId }} }}"), json!({ "id": id }))
            }
            Self::Resolve { thread_id } => (
                "mutation($id: ID!) { resolveReviewThread(input: {threadId: $id}) { thread { id } } }".to_string(),
                json!({ "id": thread_id }),
            ),
            Self::Unresolve { thread_id } => (
                "mutation($id: ID!) { unresolveReviewThread(input: {threadId: $id}) { thread { id } } }".to_string(),
                json!({ "id": thread_id }),
            ),
            Self::Review { pr_id, event, body, threads } => {
                let threads: Vec<Value> = threads
                    .iter()
                    .map(|t| {
                        let mut v = json!({ "path": t.path, "line": t.line, "side": t.side, "body": t.body });
                        if let Some(start) = t.start_line.filter(|&s| s < t.line) {
                            v["startLine"] = json!(start);
                            v["startSide"] = json!(t.side);
                        }
                        v
                    })
                    .collect();
                (
                    "mutation($id: ID!, $event: PullRequestReviewEvent!, $body: String, $threads: [DraftPullRequestReviewThread]) { addPullRequestReview(input: {pullRequestId: $id, event: $event, body: $body, threads: $threads}) { pullRequestReview { id } } }".to_string(),
                    json!({ "id": pr_id, "event": event, "body": body, "threads": threads }),
                )
            }
        };
        serde_json::to_vec(&json!({ "query": query, "variables": variables })).unwrap_or_default()
    }
}

#[derive(Deserialize)]
struct Answer {
    #[serde(default)]
    errors: Vec<GraphqlError>,
}

#[derive(Deserialize)]
struct GraphqlError {
    message: String,
}

/// GraphQL reports a refused write as `errors` in a 200 answer.
pub fn check(out: &[u8]) -> Result<(), String> {
    let answer: Answer = serde_json::from_slice(out).map_err(|e| e.to_string())?;
    match answer.errors.is_empty() {
        true => Ok(()),
        false => Err(answer.errors.into_iter().map(|e| e.message).collect::<Vec<_>>().join("; ")),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sent(m: &Mutation) -> Value {
        serde_json::from_slice(&m.request()).unwrap()
    }

    #[test]
    fn edits_pick_the_mutation_from_the_id() {
        let v = sent(&Mutation::Edit { id: "PRRC_x".into(), body: "b".into() });
        assert!(v["query"].as_str().unwrap().contains("updatePullRequestReviewComment(input: {pullRequestReviewCommentId: $id"));
        let v = sent(&Mutation::Edit { id: "IC_x".into(), body: "b".into() });
        assert!(v["query"].as_str().unwrap().contains("updateIssueComment(input: {id: $id"));
        assert_eq!(v["variables"]["body"], "b");
        let v = sent(&Mutation::Delete { id: "PRRC_y".into() });
        assert!(v["query"].as_str().unwrap().contains("deletePullRequestReviewComment"));
    }

    #[test]
    fn a_review_carries_its_pending_comments() {
        let m: Mutation = serde_json::from_str(
            r#"{"kind":"review","prId":"PR_1","event":"REQUEST_CHANGES","body":"see",
                "threads":[{"path":"a.rs","line":12,"side":"RIGHT","startLine":10,"body":"x"},{"path":"b.rs","line":3,"side":"LEFT","body":"y"}]}"#,
        )
        .unwrap();
        let v = sent(&m);
        assert_eq!(v["variables"]["event"], "REQUEST_CHANGES");
        assert_eq!(v["variables"]["threads"][0]["startLine"], 10);
        assert_eq!(v["variables"]["threads"][0]["startSide"], "RIGHT");
        assert!(v["variables"]["threads"][1].get("startLine").is_none());
    }

    #[test]
    fn errors_in_the_answer() {
        assert_eq!(check(br#"{"data":{"x":1}}"#), Ok(()));
        assert_eq!(check(br#"{"errors":[{"message":"no"},{"message":"never"}]}"#), Err("no; never".into()));
    }
}
