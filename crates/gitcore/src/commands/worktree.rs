pub const LIST_ARGS: &[&str] = &["worktree", "list", "--porcelain", "-z"];

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Worktree {
    pub path: String,
    pub head: String,
    /// None when detached.
    pub branch: Option<String>,
    pub main: bool,
    pub locked: bool,
    pub prunable: bool,
}

/// Records of `key value` lines (NUL separated), an empty field ending each worktree.
pub fn parse(out: &[u8]) -> Vec<Worktree> {
    let mut all = Vec::new();
    let mut cur: Option<Worktree> = None;
    for field in String::from_utf8_lossy(out).split('\0') {
        if field.is_empty() {
            all.extend(cur.take());
            continue;
        }
        let (key, value) = field.split_once(' ').unwrap_or((field, ""));
        match key {
            "worktree" => {
                all.extend(cur.take());
                cur = Some(Worktree { path: value.into(), head: String::new(), branch: None, main: all.is_empty(), locked: false, prunable: false });
            }
            "HEAD" => cur.iter_mut().for_each(|w| w.head = value.into()),
            "branch" => cur.iter_mut().for_each(|w| w.branch = Some(value.trim_start_matches("refs/heads/").into())),
            "locked" => cur.iter_mut().for_each(|w| w.locked = true),
            "prunable" => cur.iter_mut().for_each(|w| w.prunable = true),
            _ => {}
        }
    }
    all.extend(cur);
    all
}

/// A new worktree at `path`: on `branch` when it exists, else a new branch from HEAD.
pub fn add_args(path: &str, branch: &str, new_branch: bool) -> Vec<String> {
    if new_branch {
        ["worktree", "add", "-b", branch, "--", path].map(String::from).to_vec()
    } else {
        ["worktree", "add", "--", path, branch].map(String::from).to_vec()
    }
}

pub fn remove_args(path: &str, force: bool) -> Vec<String> {
    let mut a: Vec<String> = ["worktree", "remove"].map(String::from).to_vec();
    if force {
        a.push("--force".into());
    }
    a.extend(["--".into(), path.into()]);
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn porcelain_records() {
        let out = b"worktree E:/a\0HEAD abc\0branch refs/heads/main\0\0worktree E:/b\0HEAD def\0detached\0locked\0\0";
        let w = parse(out);
        assert_eq!(w.len(), 2);
        assert_eq!((w[0].path.as_str(), w[0].branch.as_deref(), w[0].main), ("E:/a", Some("main"), true));
        assert_eq!((w[1].branch.as_deref(), w[1].locked, w[1].main), (None, true, false));
    }

    #[test]
    fn add_forms() {
        assert_eq!(add_args("E:/w", "feat", true), ["worktree", "add", "-b", "feat", "--", "E:/w"]);
        assert_eq!(add_args("E:/w", "main", false), ["worktree", "add", "--", "E:/w", "main"]);
    }
}
