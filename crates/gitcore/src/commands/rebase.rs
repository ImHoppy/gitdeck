use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum RebaseAction {
    Continue,
    Skip,
    Abort,
}

pub fn args(action: RebaseAction) -> &'static [&'static str] {
    match action {
        // core.editor=true accepts the message git would open an editor for
        RebaseAction::Continue => &["-c", "core.editor=true", "rebase", "--continue"],
        RebaseAction::Skip => &["rebase", "--skip"],
        RebaseAction::Abort => &["rebase", "--abort"],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn continue_never_opens_an_editor() {
        assert_eq!(args(RebaseAction::Continue), ["-c", "core.editor=true", "rebase", "--continue"]);
        assert_eq!(args(RebaseAction::Abort), ["rebase", "--abort"]);
    }
}
