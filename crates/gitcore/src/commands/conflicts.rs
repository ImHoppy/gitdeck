pub const ARGS: &[&str] = &["diff", "--name-only", "--diff-filter=U", "-z"];

pub fn parse(out: &[u8]) -> Vec<String> {
    out.split(|&b| b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).into_owned())
        .collect()
}

/// `status` names who changed what in each conflicted file, which `diff --diff-filter=U` doesn't.
/// No optional locks: a read must never hold the index while a rebase or merge writes it.
pub const STATUS_ARGS: &[&str] = &["--no-optional-locks", "status", "--porcelain=v1", "-z", "--untracked-files=no"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConflictKind {
    BothModified,
    BothAdded,
    BothDeleted,
    /// Gone on "ours" (the branch checked out, or the upstream during a rebase).
    DeletedByUs,
    DeletedByThem,
    AddedByUs,
    AddedByThem,
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct Conflict {
    pub path: String,
    pub kind: ConflictKind,
}

pub fn parse_status(out: &[u8]) -> Vec<Conflict> {
    let mut found = Vec::new();
    let mut entries = out.split(|&b| b == 0).filter(|e| e.len() > 3);
    while let Some(e) = entries.next() {
        let (xy, path) = (&e[..2], String::from_utf8_lossy(&e[3..]).into_owned());
        // a rename carries its old path as the next entry
        if matches!(xy[0], b'R' | b'C') {
            entries.next();
        }
        let kind = match xy {
            b"UU" => ConflictKind::BothModified,
            b"AA" => ConflictKind::BothAdded,
            b"DD" => ConflictKind::BothDeleted,
            b"DU" => ConflictKind::DeletedByUs,
            b"UD" => ConflictKind::DeletedByThem,
            b"AU" => ConflictKind::AddedByUs,
            b"UA" => ConflictKind::AddedByThem,
            _ => continue,
        };
        found.push(Conflict { path, kind });
    }
    found
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Side {
    Ours,
    Theirs,
}

/// The git calls that settle `c` by keeping one side whole, staging the result.
pub fn take_args(c: &Conflict, side: Side) -> Vec<Vec<String>> {
    use ConflictKind::*;
    let gone = match side {
        Side::Ours => matches!(c.kind, DeletedByUs | BothDeleted | AddedByThem),
        Side::Theirs => matches!(c.kind, DeletedByThem | BothDeleted | AddedByUs),
    };
    let p = c.path.clone();
    if gone {
        return vec![vec!["rm".into(), "--quiet".into(), "--".into(), p]];
    }
    let flag = if side == Side::Ours { "--ours" } else { "--theirs" };
    vec![vec!["checkout".into(), flag.into(), "--".into(), p.clone()], mark_resolved_args(&p)]
}

/// Stages the file as it is now in the worktree, which is git's "resolved".
pub fn mark_resolved_args(path: &str) -> Vec<String> {
    vec!["add".into(), "--".into(), path.into()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_nul_separated_paths() {
        assert_eq!(parse(b"a.txt\x00dir/b c.txt\x00"), ["a.txt", "dir/b c.txt"]);
        assert!(parse(b"").is_empty());
    }

    #[test]
    fn conflict_kinds_from_status() {
        let out = b"UU a.txt\0M  clean.txt\0UD gone.txt\0AA new.txt\0";
        let c = parse_status(out);
        assert_eq!(c.iter().map(|c| (c.path.as_str(), c.kind)).collect::<Vec<_>>(), [
            ("a.txt", ConflictKind::BothModified),
            ("gone.txt", ConflictKind::DeletedByThem),
            ("new.txt", ConflictKind::BothAdded),
        ]);
    }

    #[test]
    fn taking_a_side() {
        let c = |kind| Conflict { path: "f".into(), kind };
        assert_eq!(take_args(&c(ConflictKind::BothModified), Side::Theirs), [vec!["checkout", "--theirs", "--", "f"], vec!["add", "--", "f"]]);
        assert_eq!(take_args(&c(ConflictKind::DeletedByThem), Side::Theirs), [vec!["rm", "--quiet", "--", "f"]]);
        assert_eq!(take_args(&c(ConflictKind::DeletedByThem), Side::Ours)[0], ["checkout", "--ours", "--", "f"]);
    }
}
