/// Every commit reachable from HEAD with its author and line counts (no merges: their numstat
/// repeats the branch's own changes).
pub const LOG_ARGS: &[&str] = &[
    "-c",
    "log.showSignature=false",
    "log",
    "--no-merges",
    "--format=%x1e%aN%x1f%aE%x1f%at",
    "--numstat",
    "HEAD",
];

/// `--stage` shows the mode, so submodules (160000) can be left out: they are repos, not files.
pub const FILES_ARGS: &[&str] = &["ls-files", "-z", "--stage"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CommitStat {
    pub author: String,
    pub email: String,
    pub time: i64,
    pub added: u64,
    pub removed: u64,
}

pub fn parse_log(out: &[u8]) -> Vec<CommitStat> {
    let text = String::from_utf8_lossy(out);
    text.split('\x1e')
        .filter_map(|rec| {
            let mut lines = rec.lines();
            let mut head = lines.next()?.split('\x1f');
            let (author, email, time) = (head.next()?, head.next()?, head.next()?.trim().parse().ok()?);
            let (mut added, mut removed) = (0, 0);
            for line in lines {
                let mut cols = line.split('\t');
                // binary files show "-": they count as a change but no lines
                added += cols.next().and_then(|n| n.parse::<u64>().ok()).unwrap_or(0);
                removed += cols.next().and_then(|n| n.parse::<u64>().ok()).unwrap_or(0);
            }
            Some(CommitStat { author: author.to_string(), email: email.to_string(), time, added, removed })
        })
        .collect()
}

/// Tracked files grouped by extension ("" for none), most first.
pub fn files_by_extension(out: &[u8]) -> Vec<(String, u64)> {
    let mut counts = std::collections::HashMap::<String, u64>::new();
    for entry in out.split(|&b| b == 0).filter(|p| !p.is_empty()) {
        let entry = String::from_utf8_lossy(entry);
        // "<mode> <sha> <stage>\t<path>"
        let Some((meta, path)) = entry.split_once('\t') else { continue };
        if meta.starts_with("160000") {
            continue;
        }
        let name = path.rsplit('/').next().unwrap_or(&path);
        let ext = match name.rfind('.') {
            Some(i) if i > 0 => name[i + 1..].to_lowercase(),
            _ => String::new(),
        };
        *counts.entry(ext).or_default() += 1;
    }
    let mut all: Vec<(String, u64)> = counts.into_iter().collect();
    all.sort_by(|a, b| b.1.cmp(&a.1).then_with(|| a.0.cmp(&b.0)));
    all
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numstat_records() {
        let out = b"\x1eAnn\x1fann@x\x1f100\n\n3\t1\ta.rs\n-\t-\timg.png\n\x1eBob\x1fbob@x\x1f50\n\n10\t0\tb.ts\n";
        let s = parse_log(out);
        assert_eq!(s.len(), 2);
        assert_eq!((s[0].author.as_str(), s[0].added, s[0].removed, s[0].time), ("Ann", 3, 1, 100));
        assert_eq!((s[1].email.as_str(), s[1].added), ("bob@x", 10));
    }

    #[test]
    fn extensions() {
        let e = |p: &str| format!("100644 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0\t{p}\0");
        let sub = "160000 e69de29bb2d1d6434b8b29ae775ad8c2e48c5391 0\tresources/[peds]\0";
        let out = [e("src/a.rs"), e("src/b.RS"), e("README"), e(".gitignore"), e("web/x.tsx"), sub.to_string()].concat();
        let out = out.as_bytes();
        assert_eq!(
            files_by_extension(out),
            [("".to_string(), 2), ("rs".to_string(), 2), ("tsx".to_string(), 1)]
        );
    }
}
