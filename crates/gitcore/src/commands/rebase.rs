use crate::model::Operation;
use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RebaseAction {
    Continue,
    Skip,
    Abort,
}

/// Continue / skip / abort for whichever operation is in progress.
pub fn args(op: Operation, action: RebaseAction) -> Vec<String> {
    let cmd = match op {
        Operation::Rebase => "rebase",
        Operation::Merge => "merge",
        Operation::CherryPick => "cherry-pick",
        Operation::Revert => "revert",
    };
    let flag = match action {
        RebaseAction::Continue => "--continue",
        RebaseAction::Skip => "--skip",
        RebaseAction::Abort => "--abort",
    };
    // core.editor=true accepts the message git would open an editor for
    ["-c", "core.editor=true", cmd, flag].map(String::from).to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn continue_never_opens_an_editor() {
        assert_eq!(args(Operation::Rebase, RebaseAction::Continue), ["-c", "core.editor=true", "rebase", "--continue"]);
        assert_eq!(args(Operation::CherryPick, RebaseAction::Abort), ["-c", "core.editor=true", "cherry-pick", "--abort"]);
    }
}
