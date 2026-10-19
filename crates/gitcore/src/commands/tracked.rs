pub fn gitmodules_branch_args(path_in_parent: &str) -> Vec<String> {
    vec!["config".into(), "-f".into(), ".gitmodules".into(), format!("submodule.{path_in_parent}.branch")]
}

pub const REMOTE_HEAD_ARGS: &[&str] = &["symbolic-ref", "--short", "-q", "refs/remotes/origin/HEAD"];

pub const LOCAL_BRANCHES_ARGS: &[&str] = &["for-each-ref", "--format=%(refname:short)", "refs/heads"];

pub fn submodule_args(op: &str, path_in_parent: &str) -> Vec<String> {
    let mut a: Vec<String> = vec!["submodule".into(), "update".into()];
    if op == "init" {
        a.push("--init".into());
    }
    a.extend(["--".into(), path_in_parent.into()]);
    a
}

/// `origin/main` → `main`; `.gitmodules` names a plain branch already.
pub fn branch_name(out: &[u8]) -> Option<String> {
    let s = String::from_utf8_lossy(out).trim().to_string();
    let s = s.strip_prefix("origin/").map(str::to_string).unwrap_or(s);
    (!s.is_empty() && s != ".").then_some(s)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_branch_names() {
        assert_eq!(branch_name(b"origin/main\n").as_deref(), Some("main"));
        assert_eq!(branch_name(b"develop\n").as_deref(), Some("develop"));
        assert_eq!(branch_name(b".\n"), None);
        assert_eq!(submodule_args("init", "a/b"), ["submodule", "update", "--init", "--", "a/b"]);
    }
}
