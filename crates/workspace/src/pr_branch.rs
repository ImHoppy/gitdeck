//! Which local branch "Switch to this branch" lands on for a PR, decided from the refs alone.

use gitcore::commands::{
    pull_ref,
    refs::{GitRef, RefKind},
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrHead {
    pub number: u64,
    pub head_ref_name: String,
    /// The head lives in a fork, not in this repo.
    pub is_cross_repository: bool,
    /// The fork lets maintainers push: it becomes a remote and the branch tracks it.
    #[serde(default)]
    pub maintainer_can_modify: bool,
    /// `owner/name` of the fork.
    #[serde(default)]
    pub head_repo: Option<String>,
}

/// What to do when a local branch has the PR's name but follows something else.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ClashChoice {
    /// Switch to that branch as it is.
    UseExisting,
    /// Make `pr/<n>-<name>` instead.
    Separate,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Plan {
    /// A local branch already follows the PR head.
    Existing { branch: String },
    /// A new local branch from `start`, tracking `upstream` when there is one to push to.
    Create { branch: String, start: String, upstream: Option<String> },
    /// The PR's name is taken by a branch following something else: the user picks.
    Clash { branch: String, separate: String },
}

/// The local branch a fork's PR gets, kept apart from the user's own names.
pub fn separate_name(pr: &PrHead) -> String {
    format!("pr/{}-{}", pr.number, pr.head_ref_name)
}

/// `fork` is the remote added for the fork when maintainers can push to it.
pub fn plan(refs: &[GitRef], remote: &str, pr: &PrHead, fork: Option<&str>, choice: Option<ClashChoice>) -> Plan {
    let push_remote = if pr.is_cross_repository { fork } else { Some(remote) };
    let upstream = push_remote.map(|r| format!("{r}/{}", pr.head_ref_name));
    let branches: Vec<&GitRef> = refs.iter().filter(|r| r.kind == RefKind::Branch).collect();
    let separate = separate_name(pr);
    if let Some(up) = &upstream {
        if let Some(b) = branches.iter().find(|b| b.upstream.as_deref() == Some(up)) {
            return Plan::Existing { branch: b.name.clone() };
        }
    }
    if pr.is_cross_repository && branches.iter().any(|b| b.name == separate) {
        return Plan::Existing { branch: separate };
    }
    let start = match &upstream {
        Some(up) => up.clone(),
        None => pull_ref::local_ref(remote, pr.number).trim_start_matches("refs/remotes/").to_string(),
    };
    let wanted = if pr.is_cross_repository { separate.clone() } else { pr.head_ref_name.clone() };
    let taken = branches.iter().any(|b| b.name == wanted);
    match (taken, choice) {
        (false, _) => Plan::Create { branch: wanted, start, upstream },
        (true, Some(ClashChoice::UseExisting)) => Plan::Existing { branch: wanted },
        (true, Some(ClashChoice::Separate)) if wanted != separate => Plan::Create { branch: separate, start, upstream },
        (true, _) => Plan::Clash { branch: wanted, separate },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn branch(name: &str, upstream: Option<&str>) -> GitRef {
        GitRef { sha: "a".into(), kind: RefKind::Branch, name: name.into(), upstream: upstream.map(String::from) }
    }

    fn pr(fork: bool) -> PrHead {
        PrHead { number: 7, head_ref_name: "feat".into(), is_cross_repository: fork, maintainer_can_modify: false, head_repo: None }
    }

    #[test]
    fn a_tracking_branch_is_reused_whatever_its_name() {
        let refs = [branch("main", Some("origin/main")), branch("my-feat", Some("origin/feat"))];
        assert_eq!(plan(&refs, "origin", &pr(false), None, None), Plan::Existing { branch: "my-feat".into() });
    }

    #[test]
    fn a_remote_only_branch_is_tracked() {
        let refs = [branch("main", Some("origin/main"))];
        assert_eq!(
            plan(&refs, "origin", &pr(false), None, None),
            Plan::Create { branch: "feat".into(), start: "origin/feat".into(), upstream: Some("origin/feat".into()) }
        );
    }

    #[test]
    fn a_name_clash_asks_then_follows_the_choice() {
        let refs = [branch("feat", Some("origin/other"))];
        let clash = plan(&refs, "origin", &pr(false), None, None);
        assert_eq!(clash, Plan::Clash { branch: "feat".into(), separate: "pr/7-feat".into() });
        assert_eq!(plan(&refs, "origin", &pr(false), None, Some(ClashChoice::UseExisting)), Plan::Existing { branch: "feat".into() });
        assert!(matches!(
            plan(&refs, "origin", &pr(false), None, Some(ClashChoice::Separate)),
            Plan::Create { branch, .. } if branch == "pr/7-feat"
        ));
    }

    #[test]
    fn a_fork_comes_from_refs_pull_unless_it_can_be_pushed_to() {
        assert_eq!(
            plan(&[], "origin", &pr(true), None, None),
            Plan::Create { branch: "pr/7-feat".into(), start: "origin/pr/7".into(), upstream: None }
        );
        assert_eq!(
            plan(&[], "origin", &pr(true), Some("alice"), None),
            Plan::Create { branch: "pr/7-feat".into(), start: "alice/feat".into(), upstream: Some("alice/feat".into()) }
        );
        let refs = [branch("pr/7-feat", None)];
        assert_eq!(plan(&refs, "origin", &pr(true), None, None), Plan::Existing { branch: "pr/7-feat".into() });
    }
}
