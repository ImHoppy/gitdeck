use serde::Serialize;
use std::collections::HashMap;

pub fn args(sha: &str, path: &str) -> Vec<String> {
    vec!["blame".into(), "--porcelain".into(), sha.into(), "--".into(), path.into()]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlameLine {
    pub sha: String,
    pub author: String,
    pub time: i64,
    pub summary: String,
    pub text: String,
}

#[derive(Default, Clone)]
struct Info {
    author: String,
    time: i64,
    summary: String,
}

/// `--porcelain` prints a commit's details only the first time it appears, so they are remembered.
pub fn parse(out: &[u8]) -> Vec<BlameLine> {
    let text = String::from_utf8_lossy(out);
    let mut known: HashMap<String, Info> = HashMap::new();
    let mut lines = Vec::new();
    let mut current: Option<String> = None;
    for line in text.lines() {
        if let Some(code) = line.strip_prefix('\t') {
            let sha = current.take().unwrap_or_default();
            let info = known.get(&sha).cloned().unwrap_or_default();
            lines.push(BlameLine { sha, author: info.author, time: info.time, summary: info.summary, text: code.to_string() });
        } else if let Some((key, value)) = line.split_once(' ') {
            match (key, &current) {
                ("author", Some(sha)) => known.entry(sha.clone()).or_default().author = value.to_string(),
                ("author-time", Some(sha)) => known.entry(sha.clone()).or_default().time = value.parse().unwrap_or(0),
                ("summary", Some(sha)) => known.entry(sha.clone()).or_default().summary = value.to_string(),
                _ if is_object_id(key) => current = Some(key.to_string()),
                _ => {}
            }
        }
    }
    lines
}

/// SHA-1 (40 hex digits) or SHA-256 (64), the default of Git 3.0.
fn is_object_id(s: &str) -> bool {
    matches!(s.len(), 40 | 64) && s.bytes().all(|b| b.is_ascii_hexdigit())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reuses_details_of_repeated_commits() {
        let a = "a".repeat(40);
        let out = format!(
            "{a} 1 1 2\nauthor Ann\nauthor-time 100\nsummary first\nfilename f\n\tline one\n{a} 2 2\n\tline two\n"
        );
        let lines = parse(out.as_bytes());
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[1].author, "Ann");
        assert_eq!(lines[1].text, "line two");
        assert_eq!(lines[0].summary, "first");
    }

    #[test]
    fn reads_sha256_repositories() {
        let a = "b".repeat(64);
        let lines = parse(format!("{a} 1 1 1\nauthor Bo\nauthor-time 5\nsummary s\nfilename f\n\tcode\n").as_bytes());
        assert_eq!(lines[0].sha, a);
        assert_eq!(lines[0].author, "Bo");
    }
}
