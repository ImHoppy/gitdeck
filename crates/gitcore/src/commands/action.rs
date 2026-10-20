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
    Merge {
        rev: String,
        #[serde(default)]
        mode: MergeMode,
    },
    Rebase { onto: String },
    CherryPick { sha: String },
    Revert { sha: String },
    Reset { sha: String, mode: ResetMode },
    CreateTag {
        name: String,
        at: String,
        /// Makes an annotated tag carrying this message.
        #[serde(default)]
        message: Option<String>,
    },
    DeleteTag { name: String },
    StashPush { message: String, untracked: bool },
    StashApply { index: u32 },
    StashPop { index: u32 },
    StashDrop { index: u32 },
    RecordPointers { paths: Vec<String> },
    /// Pushes a branch with no upstream yet and makes `remote/branch` its upstream.
    Publish { remote: String, branch: String },
    /// After a rebase or amend; refused when the remote moved since the last fetch.
    ForcePush,
    PushTags { remote: String },
    PushTag { remote: String, name: String },
    DeleteRemoteTag { remote: String, name: String },
    AddRemote { name: String, url: String },
    RemoveRemote { name: String },
    RenameRemote { from: String, to: String },
    SetRemoteUrl { name: String, url: String },
    FetchRemote { name: String },
    /// Drops remote-tracking branches whose branch is gone on the remote.
    PruneRemote { name: String },
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MergeMode {
    /// Fast-forward when possible, else a merge commit (git's default).
    #[default]
    Default,
    /// Always a merge commit.
    NoFastForward,
    /// The branch's changes staged as one commit to make, no merge recorded.
    Squash,
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
            Self::Merge { rev, mode } => match mode {
                MergeMode::Default => v(&["merge", "--no-edit", rev]),
                MergeMode::NoFastForward => v(&["merge", "--no-edit", "--no-ff", rev]),
                MergeMode::Squash => v(&["merge", "--squash", rev]),
            },
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
            Self::CreateTag { name, at, message: Some(m) } if !m.trim().is_empty() => v(&["tag", "-a", name, "-m", m, at]),
            Self::CreateTag { name, at, .. } => v(&["tag", name, at]),
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
            Self::Publish { remote, branch } => v(&["push", "--set-upstream", remote, branch]),
            Self::ForcePush => v(&["push", "--force-with-lease", "--force-if-includes"]),
            Self::PushTags { remote } => v(&["push", remote, "--tags"]),
            Self::PushTag { remote, name } => v(&["push", remote, &format!("refs/tags/{name}")]),
            Self::DeleteRemoteTag { remote, name } => v(&["push", remote, "--delete", &format!("refs/tags/{name}")]),
            Self::AddRemote { name, url } => v(&["remote", "add", name, url]),
            Self::RemoveRemote { name } => v(&["remote", "remove", name]),
            Self::RenameRemote { from, to } => v(&["remote", "rename", from, to]),
            Self::SetRemoteUrl { name, url } => v(&["remote", "set-url", name, url]),
            Self::FetchRemote { name } => v(&["fetch", "--prune", name]),
            Self::PruneRemote { name } => v(&["remote", "prune", name]),
            Self::RecordPointers { paths } => {
                let mut a = v(&["add", "--"]);
                a.extend(paths.iter().cloned());
                a
            }
        }
    }

    /// Talks to a remote, so it gets the network timeout and auth error handling.
    pub fn is_remote(&self) -> bool {
        matches!(
            self,
            Self::DeleteRemoteBranch { .. }
                | Self::Publish { .. }
                | Self::ForcePush
                | Self::PushTags { .. }
                | Self::PushTag { .. }
                | Self::DeleteRemoteTag { .. }
                | Self::FetchRemote { .. }
                | Self::PruneRemote { .. }
        )
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

    #[test]
    fn push_variants() {
        let a: Action = serde_json::from_str(r#"{"kind":"publish","remote":"origin","branch":"feat/x"}"#).unwrap();
        assert_eq!(a.args(), ["push", "--set-upstream", "origin", "feat/x"]);
        let a: Action = serde_json::from_str(r#"{"kind":"forcePush"}"#).unwrap();
        assert_eq!(a.args(), ["push", "--force-with-lease", "--force-if-includes"]);
        let a: Action = serde_json::from_str(r#"{"kind":"deleteRemoteTag","remote":"origin","name":"v1"}"#).unwrap();
        assert_eq!(a.args(), ["push", "origin", "--delete", "refs/tags/v1"]);
        assert!(a.is_remote());
    }

    #[test]
    fn merge_modes_tags_and_remotes() {
        let a: Action = serde_json::from_str(r#"{"kind":"merge","rev":"f"}"#).unwrap();
        assert_eq!(a.args(), ["merge", "--no-edit", "f"]);
        let a: Action = serde_json::from_str(r#"{"kind":"merge","rev":"f","mode":"squash"}"#).unwrap();
        assert_eq!(a.args(), ["merge", "--squash", "f"]);
        let a: Action = serde_json::from_str(r#"{"kind":"createTag","name":"v2","at":"abc","message":"Release 2"}"#).unwrap();
        assert_eq!(a.args(), ["tag", "-a", "v2", "-m", "Release 2", "abc"]);
        let a: Action = serde_json::from_str(r#"{"kind":"createTag","name":"v2","at":"abc"}"#).unwrap();
        assert_eq!(a.args(), ["tag", "v2", "abc"]);
        let a: Action = serde_json::from_str(r#"{"kind":"setRemoteUrl","name":"origin","url":"git@x:y.git"}"#).unwrap();
        assert_eq!(a.args(), ["remote", "set-url", "origin", "git@x:y.git"]);
    }
}
