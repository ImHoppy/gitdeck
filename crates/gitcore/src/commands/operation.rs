use crate::model::Operation;
use std::path::Path;

pub fn detect(gitdir: &Path) -> Option<Operation> {
    let has = |p: &str| gitdir.join(p).exists();
    if has("rebase-merge") || has("rebase-apply") {
        Some(Operation::Rebase)
    } else if has("MERGE_HEAD") {
        Some(Operation::Merge)
    } else if has("CHERRY_PICK_HEAD") {
        Some(Operation::CherryPick)
    } else if has("REVERT_HEAD") {
        Some(Operation::Revert)
    } else {
        None
    }
}
