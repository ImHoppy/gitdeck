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
}
