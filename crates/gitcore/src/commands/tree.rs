use serde::Serialize;

pub fn ls_args(sha: &str, dir: &str) -> Vec<String> {
    let spec = if dir.is_empty() { sha.to_string() } else { format!("{sha}:{dir}") };
    vec!["ls-tree".into(), "-z".into(), "--long".into(), spec]
}

pub fn show_args(sha: &str, path: &str) -> Vec<String> {
    vec!["show".into(), format!("{sha}:{path}")]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TreeEntry {
    pub name: String,
    pub kind: String,
    pub size: Option<u64>,
}

/// `<mode> <type> <sha> <size>\t<name>` records; directories first, then by name.
pub fn parse_ls(out: &[u8]) -> Vec<TreeEntry> {
    let mut entries: Vec<TreeEntry> = out
        .split(|&b| b == 0)
        .filter_map(|rec| {
            let rec = std::str::from_utf8(rec).ok()?;
            let (meta, name) = rec.split_once('\t')?;
            let mut f = meta.split_whitespace();
            let _mode = f.next()?;
            let kind = f.next()?.to_string();
            let _sha = f.next()?;
            let size = f.next().and_then(|s| s.parse().ok());
            Some(TreeEntry { name: name.to_string(), kind, size })
        })
        .collect();
    entries.sort_by(|a, b| (a.kind != "tree").cmp(&(b.kind != "tree")).then_with(|| a.name.cmp(&b.name)));
    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_directories_first() {
        let out = b"100644 blob aaa      12\tb.txt\x00040000 tree bbb       -\tsrc\x00160000 commit ccc       -\tsub\x00";
        let e = parse_ls(out);
        assert_eq!(e.iter().map(|e| e.name.as_str()).collect::<Vec<_>>(), ["src", "b.txt", "sub"]);
        assert_eq!(e[1].size, Some(12));
        assert_eq!(e[2].kind, "commit");
    }
}
