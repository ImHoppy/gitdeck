//! Which PRs a list holds and in what order, as GitHub's own list filters them: a state, whose
//! PRs, labels, and a sort. The repo's PR connection only filters by state, so anything more is a
//! GitHub search, the same one github.com runs for its list.

use super::pr_list::{ListState, Scope};
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Sort {
    Created,
    #[default]
    Updated,
    Comments,
    /// The search's relevance; with no words to match, GitHub's own pick.
    BestMatch,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Order {
    Asc,
    #[default]
    Desc,
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Query {
    pub state: ListState,
    #[serde(default)]
    pub scope: Scope,
    /// Every one of these labels, as GitHub's label filter means several.
    #[serde(default)]
    pub labels: Vec<String>,
    /// Only PRs without any label.
    #[serde(default)]
    pub no_label: bool,
    #[serde(default)]
    pub sort: Sort,
    #[serde(default)]
    pub order: Order,
}

impl Query {
    pub fn open() -> Self {
        Self { state: ListState::Open, scope: Scope::All, labels: Vec::new(), no_label: false, sort: Sort::Updated, order: Order::Desc }
    }

    /// The repo's connection takes the state and an order, nothing else.
    pub fn needs_search(&self) -> bool {
        self.scope != Scope::All || !self.labels.is_empty() || self.no_label || self.sort == Sort::BestMatch
    }

    /// The connection's `orderBy`.
    pub fn order_by(&self) -> serde_json::Value {
        let field = match self.sort {
            Sort::Created => "CREATED_AT",
            Sort::Comments => "COMMENTS",
            Sort::Updated | Sort::BestMatch => "UPDATED_AT",
        };
        let direction = match self.order {
            Order::Asc => "ASC",
            Order::Desc => "DESC",
        };
        serde_json::json!({ "field": field, "direction": direction })
    }

    /// The search github.com runs for the same list.
    pub fn search(&self, repo: &GithubRepo) -> String {
        let mut q = vec![format!("repo:{}", repo.slug()), "is:pr".into(), self.state.qualifier().into()];
        match self.scope {
            Scope::All => {}
            Scope::Mine => q.push("author:@me".into()),
            Scope::Review => q.push("review-requested:@me".into()),
        }
        if self.no_label {
            q.push("no:label".into());
        }
        q.extend(self.labels.iter().map(|l| format!("label:\"{}\"", l.replace('"', ""))));
        let order = match self.order {
            Order::Asc => "asc",
            Order::Desc => "desc",
        };
        match self.sort {
            Sort::Created => q.push(format!("sort:created-{order}")),
            Sort::Updated => q.push(format!("sort:updated-{order}")),
            Sort::Comments => q.push(format!("sort:comments-{order}")),
            Sort::BestMatch => {}
        }
        q.join(" ")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo() -> GithubRepo {
        GithubRepo { owner: "a".into(), name: "b".into() }
    }

    #[test]
    fn the_default_list_reads_the_connection() {
        let q = Query::open();
        assert!(!q.needs_search());
        assert_eq!(q.order_by(), serde_json::json!({ "field": "UPDATED_AT", "direction": "DESC" }));
        let q = Query { sort: Sort::Comments, order: Order::Asc, ..Query::open() };
        assert!(!q.needs_search());
        assert_eq!(q.order_by(), serde_json::json!({ "field": "COMMENTS", "direction": "ASC" }));
    }

    #[test]
    fn labels_and_best_match_are_searches() {
        let q = Query { labels: vec!["bug".into(), "help wanted".into()], sort: Sort::Created, order: Order::Asc, ..Query::open() };
        assert!(q.needs_search());
        assert_eq!(q.search(&repo()), r#"repo:a/b is:pr is:open label:"bug" label:"help wanted" sort:created-asc"#);
        let q = Query { state: ListState::Merged, scope: Scope::Mine, no_label: true, sort: Sort::BestMatch, ..Query::open() };
        assert_eq!(q.search(&repo()), "repo:a/b is:pr is:merged author:@me no:label");
    }

    #[test]
    fn missing_fields_take_the_defaults() {
        let q: Query = serde_json::from_str(r#"{"state":"open"}"#).unwrap();
        assert_eq!(q, Query::open());
    }
}
