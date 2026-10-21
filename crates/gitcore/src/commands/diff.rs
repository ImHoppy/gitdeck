use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum DiffTarget {
    Worktree,
    Index,
    Commit { sha: String, parent: Option<String> },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
    Renamed,
    Copied,
    TypeChanged,
    Unmerged,
    Untracked,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChangedFile {
    pub path: String,
    pub old_path: Option<String>,
    pub kind: ChangeKind,
}

pub fn files_args(target: &DiffTarget, content: Option<&str>) -> Vec<String> {
    let mut a: Vec<String> = match target {
        DiffTarget::Worktree => vec!["diff".into()],
        DiffTarget::Index => vec!["diff".into(), "--cached".into()],
        DiffTarget::Commit { sha, parent: Some(p) } => vec!["diff".into(), p.clone(), sha.clone()],
        DiffTarget::Commit { sha, parent: None } => vec!["diff-tree".into(), "--no-commit-id".into(), "--root".into(), "-r".into(), sha.clone()],
    };
    a.extend(["--name-status", "-z", "-M", "--no-ext-diff", "--ignore-submodules=none"].map(String::from));
    if let Some(re) = content {
        a.push(format!("-G{re}"));
    }
    a
}

pub const UNTRACKED_ARGS: &[&str] = &["ls-files", "--others", "--exclude-standard", "-z"];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PatchOptions {
    pub context: u32,
    pub ignore_whitespace: bool,
}

impl Default for PatchOptions {
    fn default() -> Self {
        Self { context: 3, ignore_whitespace: false }
    }
}

pub fn patch_args(target: &DiffTarget, file: &ChangedFile, opts: PatchOptions) -> Vec<String> {
    let mut a: Vec<String> = vec!["-c".into(), "core.quotePath=false".into()];
    let unified = format!("-U{}", opts.context);
    let ws = if opts.ignore_whitespace { "-w" } else { "--no-ext-diff" };
    if file.kind == ChangeKind::Untracked {
        a.extend(["diff", "--no-index", "--no-ext-diff", ws, &unified, "--", "/dev/null", &file.path].map(String::from));
        return a;
    }
    match target {
        DiffTarget::Worktree => a.push("diff".into()),
        DiffTarget::Index => a.extend(["diff".into(), "--cached".into()]),
        DiffTarget::Commit { sha, parent: Some(p) } => a.extend(["diff".into(), p.clone(), sha.clone()]),
        DiffTarget::Commit { sha, parent: None } => {
            a.extend(["diff-tree".into(), "--no-commit-id".into(), "-p".into(), "--root".into(), sha.clone()])
        }
    }
    a.extend(["-M", "--no-ext-diff", "--no-color", ws, &unified, "--"].map(String::from));
    if let Some(old) = &file.old_path {
        a.push(old.clone());
    }
    a.push(file.path.clone());
    a
}

pub fn parse_name_status(out: &[u8]) -> Vec<ChangedFile> {
    let mut fields = out.split(|&b| b == 0).map(|f| String::from_utf8_lossy(f).into_owned());
    let mut files = Vec::new();
    while let Some(status) = fields.next() {
        let Some(code) = status.chars().next() else { continue };
        let kind = match code {
            'A' => ChangeKind::Added,
            'M' => ChangeKind::Modified,
            'D' => ChangeKind::Deleted,
            'R' => ChangeKind::Renamed,
            'C' => ChangeKind::Copied,
            'T' => ChangeKind::TypeChanged,
            'U' => ChangeKind::Unmerged,
            _ => continue,
        };
        let Some(first) = fields.next() else { break };
        let file = if matches!(kind, ChangeKind::Renamed | ChangeKind::Copied) {
            let Some(path) = fields.next() else { break };
            ChangedFile { path, old_path: Some(first), kind }
        } else {
            ChangedFile { path: first, old_path: None, kind }
        };
        files.push(file);
    }
    files
}

pub fn parse_untracked(out: &[u8]) -> Vec<ChangedFile> {
    out.split(|&b| b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| ChangedFile { path: String::from_utf8_lossy(p).into_owned(), old_path: None, kind: ChangeKind::Untracked })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_name_status_with_renames() {
        let out = b"M\0src/a.rs\0R087\0old.txt\0new.txt\0D\0gone\0";
        let files = parse_name_status(out);
        assert_eq!(files.len(), 3);
        assert_eq!(files[1], ChangedFile { path: "new.txt".into(), old_path: Some("old.txt".into()), kind: ChangeKind::Renamed });
        assert_eq!(files[2].kind, ChangeKind::Deleted);
    }

    #[test]
    fn diff_tree_output_skips_the_commit_line() {
        let out = b"abc123\0A\0README\0";
        assert_eq!(parse_name_status(out), vec![ChangedFile { path: "README".into(), old_path: None, kind: ChangeKind::Added }]);
    }

    #[test]
    fn untracked_patch_compares_against_dev_null() {
        let f = ChangedFile { path: "n.txt".into(), old_path: None, kind: ChangeKind::Untracked };
        let args = patch_args(&DiffTarget::Worktree, &f, PatchOptions::default());
        assert!(args.ends_with(&["--".into(), "/dev/null".into(), "n.txt".into()]));
    }
}
