use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

const FIELDS: &str = "defaultBranchRef,rebaseMergeAllowed,squashMergeAllowed,mergeCommitAllowed,viewerPermission,deleteBranchOnMerge";

pub fn args(repo: &GithubRepo) -> Vec<String> {
    vec!["repo".into(), "view".into(), repo.slug(), "--json".into(), FIELDS.into()]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoInfo {
    pub default_branch: String,
    pub rebase_merge_allowed: bool,
    pub squash_merge_allowed: bool,
    /// `ADMIN`, `MAINTAIN`, `WRITE`, `TRIAGE` or `READ`.
    pub viewer_permission: String,
    pub delete_branch_on_merge: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Raw {
    default_branch_ref: Option<BranchRef>,
    #[serde(default)]
    rebase_merge_allowed: bool,
    #[serde(default)]
    squash_merge_allowed: bool,
    #[serde(default)]
    viewer_permission: String,
    #[serde(default)]
    delete_branch_on_merge: bool,
}

#[derive(Deserialize)]
struct BranchRef {
    name: String,
}

pub fn parse(out: &[u8]) -> Result<RepoInfo, serde_json::Error> {
    let r: Raw = serde_json::from_slice(out)?;
    Ok(RepoInfo {
        default_branch: r.default_branch_ref.map(|b| b.name).unwrap_or_default(),
        rebase_merge_allowed: r.rebase_merge_allowed,
        squash_merge_allowed: r.squash_merge_allowed,
        viewer_permission: r.viewer_permission,
        delete_branch_on_merge: r.delete_branch_on_merge,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_repo() {
        let r = parse(include_bytes!("testdata/repo_view.json")).unwrap();
        assert_eq!(r.default_branch, "trunk");
        assert!(r.rebase_merge_allowed && r.squash_merge_allowed);
        assert_eq!(r.viewer_permission, "READ");
    }
}
