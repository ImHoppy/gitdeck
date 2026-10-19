//! Branch, tag, stash and history actions from the grid and refs menus (SPEC §8).

use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ResetMode {
    Soft,
    Mixed,
    Hard,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum Action {
    Checkout { branch: String },
    CheckoutRemote { remote_branch: String, local: String },
    CheckoutDetached { sha: String },
    CreateBranch { name: String, at: String, checkout: bool },
    RenameBranch { from: String, to: String },
    DeleteBranch { name: String, force: bool },
    DeleteRemoteBranch { remote: String, name: String },
    Merge { rev: String },
    Rebase { onto: String },
    CherryPick { sha: String },
    Revert { sha: String },
    Reset { sha: String, mode: ResetMode },
    CreateTag { name: String, at: String },
    DeleteTag { name: String },
    StashPush { message: String, untracked: bool },
    StashApply { index: u32 },
    StashPop { index: u32 },
    StashDrop { index: u32 },
    RecordPointers { paths: Vec<String> },
}

impl Action {
    pub fn args(&self) -> Vec<String> {
        let v = |a: &[&str]| a.iter().map(|s| s.to_string()).collect::<Vec<_>>();
        let stash = |i: &u32| format!("stash@{{{i}}}");
        match self {
            Self::Checkout { branch } => v(&["switch", branch]),
            Self::CheckoutRemote { remote_branch, local } => v(&["switch", "-c", local, "--track", remote_branch]),
            Self::CheckoutDetached { sha } => v(&["switch", "--detach", sha]),
            Self::CreateBranch { name, at, checkout: true } => v(&["switch", "-c", name, at]),
            Self::CreateBranch { name, at, checkout: false } => v(&["branch", name, at]),
            Self::RenameBranch { from, to } => v(&["branch", "-m", from, to]),
            Self::DeleteBranch { name, force } => v(&["branch", if *force { "-D" } else { "-d" }, name]),
            Self::DeleteRemoteBranch { remote, name } => v(&["push", remote, "--delete", name]),
            Self::Merge { rev } => v(&["merge", "--no-edit", rev]),
            Self::Rebase { onto } => v(&["-c", "core.editor=true", "rebase", onto]),
            Self::CherryPick { sha } => v(&["cherry-pick", sha]),
            Self::Revert { sha } => v(&["revert", "--no-edit", sha]),
            Self::Reset { sha, mode } => {
                let m = match mode {
                    ResetMode::Soft => "--soft",
                    ResetMode::Mixed => "--mixed",
                    ResetMode::Hard => "--hard",
                };
                v(&["reset", "-q", m, sha])
            }
            Self::CreateTag { name, at } => v(&["tag", name, at]),
            Self::DeleteTag { name } => v(&["tag", "-d", name]),
            Self::StashPush { message, untracked } => {
                let mut a = v(&["stash", "push"]);
                if *untracked {
                    a.push("--include-untracked".into());
                }
                if !message.is_empty() {
                    a.extend(["-m".into(), message.clone()]);
                }
                a
            }
            Self::StashApply { index } => v(&["stash", "apply", &stash(index)]),
            Self::StashPop { index } => v(&["stash", "pop", &stash(index)]),
            Self::StashDrop { index } => v(&["stash", "drop", &stash(index)]),
            Self::RecordPointers { paths } => {
                let mut a = v(&["add", "--"]);
                a.extend(paths.iter().cloned());
                a
            }
        }
    }

    /// Talks to a remote, so it gets the network timeout and auth error handling.
    pub fn is_remote(&self) -> bool {
        matches!(self, Self::DeleteRemoteBranch { .. })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deserializes_and_builds_args() {
        let a: Action = serde_json::from_str(r#"{"kind":"createBranch","name":"feat/x","at":"abc","checkout":true}"#).unwrap();
        assert_eq!(a.args(), ["switch", "-c", "feat/x", "abc"]);
        let a: Action = serde_json::from_str(r#"{"kind":"stashPop","index":2}"#).unwrap();
        assert_eq!(a.args(), ["stash", "pop", "stash@{2}"]);
        let a: Action = serde_json::from_str(r#"{"kind":"checkoutRemote","remoteBranch":"origin/f","local":"f"}"#).unwrap();
        assert_eq!(a.args(), ["switch", "-c", "f", "--track", "origin/f"]);
        let a: Action = serde_json::from_str(r#"{"kind":"reset","sha":"abc","mode":"hard"}"#).unwrap();
        assert_eq!(a.args(), ["reset", "-q", "--hard", "abc"]);
    }
}
