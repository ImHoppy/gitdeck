pub fn stage_args(paths: &[String]) -> Vec<String> {
    // -A also records deletions of the given paths
    let mut a: Vec<String> = ["add", "-A", "--"].map(String::from).to_vec();
    a.extend(paths.iter().cloned());
    a
}

pub fn unstage_args(paths: &[String], unborn: bool) -> Vec<String> {
    let mut a: Vec<String> = if unborn {
        ["rm", "--cached", "-r", "-q", "--"].map(String::from).to_vec()
    } else {
        ["reset", "-q", "HEAD", "--"].map(String::from).to_vec()
    };
    a.extend(paths.iter().cloned());
    a
}

pub fn commit_args(message: &str, amend: bool, sign_off: bool) -> Vec<String> {
    let mut a: Vec<String> = ["commit", "--cleanup=strip", "-m"].map(String::from).to_vec();
    a.push(message.to_string());
    if amend {
        a.push("--amend".into());
    }
    if sign_off {
        a.push("--signoff".into());
    }
    a
}

/// Where `commit.template` points, if set: its text starts a new commit message.
pub const TEMPLATE_ARGS: &[&str] = &["config", "--path", "--get", "commit.template"];

pub const LAST_MESSAGE_ARGS: &[&str] = &["log", "-1", "--format=%B"];

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_args() {
        assert_eq!(stage_args(&["a b".into()]), ["add", "-A", "--", "a b"]);
        assert_eq!(unstage_args(&["x".into()], false), ["reset", "-q", "HEAD", "--", "x"]);
        assert_eq!(commit_args("msg", true, false), ["commit", "--cleanup=strip", "-m", "msg", "--amend"]);
        assert_eq!(commit_args("msg", false, true), ["commit", "--cleanup=strip", "-m", "msg", "--signoff"]);
    }
}
