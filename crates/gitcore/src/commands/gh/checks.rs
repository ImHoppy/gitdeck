//! `statusCheckRollup`: check runs (Actions) and commit statuses (other CI) mixed in one list.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckSummary {
    pub passed: u32,
    pub failed: u32,
    pub pending: u32,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "__typename")]
pub(crate) enum RollupItem {
    CheckRun {
        #[serde(default)]
        status: String,
        #[serde(default)]
        conclusion: Option<String>,
    },
    StatusContext {
        #[serde(default)]
        state: String,
    },
}

#[derive(Clone, Copy)]
enum Bucket {
    Passed,
    Failed,
    Pending,
}

impl RollupItem {
    fn bucket(&self) -> Bucket {
        match self {
            Self::CheckRun { status, .. } if status != "COMPLETED" => Bucket::Pending,
            Self::CheckRun { conclusion, .. } => match conclusion.as_deref() {
                Some("SUCCESS" | "NEUTRAL" | "SKIPPED") => Bucket::Passed,
                _ => Bucket::Failed,
            },
            Self::StatusContext { state } => match state.as_str() {
                "SUCCESS" => Bucket::Passed,
                "PENDING" | "EXPECTED" => Bucket::Pending,
                _ => Bucket::Failed,
            },
        }
    }
}

#[derive(Debug, Deserialize)]
pub(crate) struct StateCount {
    state: String,
    count: u32,
}

/// The rollup's counts per state, for the list: far lighter than every check of every PR.
#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Counts {
    #[serde(default)]
    check_run_counts_by_state: Vec<StateCount>,
    #[serde(default)]
    status_context_counts_by_state: Vec<StateCount>,
}

impl Counts {
    pub(crate) fn summary(&self) -> CheckSummary {
        let runs = self.check_run_counts_by_state.iter().map(|c| {
            let item = match c.state.as_str() {
                "IN_PROGRESS" | "PENDING" | "QUEUED" | "WAITING" | "REQUESTED" => RollupItem::CheckRun { status: "IN_PROGRESS".into(), conclusion: None },
                "COMPLETED" => RollupItem::CheckRun { status: "COMPLETED".into(), conclusion: Some("SUCCESS".into()) },
                conclusion => RollupItem::CheckRun { status: "COMPLETED".into(), conclusion: Some(conclusion.into()) },
            };
            (item, c.count)
        });
        let statuses = self.status_context_counts_by_state.iter().map(|c| (RollupItem::StatusContext { state: c.state.clone() }, c.count));
        runs.chain(statuses).fold(CheckSummary::default(), |mut s, (item, n)| {
            match item.bucket() {
                Bucket::Passed => s.passed += n,
                Bucket::Failed => s.failed += n,
                Bucket::Pending => s.pending += n,
            }
            s
        })
    }
}

pub(crate) fn summarize(items: &[RollupItem]) -> CheckSummary {
    items.iter().fold(CheckSummary::default(), |mut s, item| {
        match item.bucket() {
            Bucket::Passed => s.passed += 1,
            Bucket::Failed => s.failed += 1,
            Bucket::Pending => s.pending += 1,
        }
        s
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_and_statuses_in_buckets() {
        let items: Vec<RollupItem> = serde_json::from_str(
            r#"[
                {"__typename":"CheckRun","status":"COMPLETED","conclusion":"SUCCESS"},
                {"__typename":"CheckRun","status":"COMPLETED","conclusion":"SKIPPED"},
                {"__typename":"CheckRun","status":"COMPLETED","conclusion":"FAILURE"},
                {"__typename":"CheckRun","status":"IN_PROGRESS","conclusion":null},
                {"__typename":"StatusContext","state":"PENDING","context":"ci/x"},
                {"__typename":"StatusContext","state":"ERROR","context":"ci/y"}
            ]"#,
        )
        .unwrap();
        assert_eq!(summarize(&items), CheckSummary { passed: 2, failed: 2, pending: 2 });
    }

    #[test]
    fn counts_by_state_land_in_the_same_buckets() {
        let counts: Counts = serde_json::from_str(
            r#"{"checkRunCountsByState":[{"state":"SUCCESS","count":3},{"state":"SKIPPED","count":1},{"state":"FAILURE","count":1},
                {"state":"IN_PROGRESS","count":2},{"state":"QUEUED","count":1},{"state":"CANCELLED","count":0}],
                "statusContextCountsByState":[{"state":"SUCCESS","count":1},{"state":"PENDING","count":1},{"state":"ERROR","count":1}]}"#,
        )
        .unwrap();
        assert_eq!(counts.summary(), CheckSummary { passed: 5, failed: 2, pending: 4 });
    }
}
