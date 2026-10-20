const LIMIT: &str = "500";

/// Where HEAD has been, newest first: commits lost to a reset or rebase are still listed here.
pub fn args() -> Vec<String> {
    ["reflog", "show", "-z", "--format=%H%x1f%gd%x1f%ct%x1f%gs%x1f%s", "-n", LIMIT, "HEAD"].map(String::from).to_vec()
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReflogEntry {
    pub sha: String,
    /// `HEAD@{3}`
    pub selector: String,
    pub time: i64,
    /// What moved HEAD, e.g. "rebase (finish): returning to refs/heads/main".
    pub action: String,
    pub subject: String,
}

pub fn parse(out: &[u8]) -> Vec<ReflogEntry> {
    String::from_utf8_lossy(out)
        .split('\0')
        .filter_map(|rec| {
            let mut f = rec.trim_matches('\n').splitn(5, '\x1f');
            Some(ReflogEntry {
                sha: f.next().filter(|s| !s.is_empty())?.to_string(),
                selector: f.next()?.to_string(),
                time: f.next()?.parse().unwrap_or(0),
                action: f.next()?.to_string(),
                subject: f.next().unwrap_or("").to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entries() {
        let out = b"aaa\x1fHEAD@{0}\x1f100\x1freset: moving to HEAD~1\x1fold subject\0bbb\x1fHEAD@{1}\x1f90\x1fcommit: x\x1fx\0";
        let e = parse(out);
        assert_eq!(e.len(), 2);
        assert_eq!((e[0].selector.as_str(), e[0].action.as_str(), e[0].time), ("HEAD@{0}", "reset: moving to HEAD~1", 100));
    }
}
