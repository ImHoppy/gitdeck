pub const ARGS: &[&str] = &[
    "-c",
    "log.showSignature=false",
    "log",
    "-z",
    "--date-order",
    "--format=%H%x1f%P%x1f%at%x1f%aN%x1f%aE%x1f%B",
    "--branches",
    "--remotes",
    "--tags",
    "HEAD",
];

const BODY_HINT_CHARS: usize = 200;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LogCommit {
    pub sha: String,
    pub parents: Vec<String>,
    pub author_time: i64,
    pub author: String,
    pub email: String,
    pub subject: String,
    pub body_hint: String,
    pub multiline: bool,
}

pub fn parse(out: &[u8]) -> Vec<LogCommit> {
    out.split(|&b| b == 0).filter(|r| !r.is_empty()).filter_map(parse_record).collect()
}

fn parse_record(rec: &[u8]) -> Option<LogCommit> {
    let text = String::from_utf8_lossy(rec);
    let mut f = text.splitn(6, '\x1f');
    let sha = f.next()?.trim_start_matches('\n').to_string();
    let parents = f.next()?.split(' ').filter(|p| !p.is_empty()).map(str::to_string).collect();
    let author_time = f.next()?.parse().ok()?;
    let author = f.next()?.to_string();
    let email = f.next()?.to_string();
    let message = f.next().unwrap_or("").trim_end();
    let (subject, body) = message.split_once('\n').unwrap_or((message, ""));
    let body = body.trim();
    let body_hint: String = body.split_whitespace().collect::<Vec<_>>().join(" ").chars().take(BODY_HINT_CHARS).collect();
    Some(LogCommit {
        sha,
        parents,
        author_time,
        author,
        email,
        subject: subject.to_string(),
        multiline: !body.is_empty(),
        body_hint,
    })
}

pub fn body_args(sha: &str) -> Vec<String> {
    vec!["show".into(), "-s".into(), "--format=%B".into(), sha.into()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_records_with_body_and_merge_parents() {
        let out = b"aaa\x1fbbb ccc\x1f1700000000\x1fAnn\x1fann@x\x1fadd thing\n\nlong\nbody\n\x00\
ddd\x1f\x1f1600000000\x1fBob\x1fbob@x\x1froot\n\x00";
        let commits = parse(out);
        assert_eq!(commits.len(), 2);
        assert_eq!(commits[0].parents, ["bbb", "ccc"]);
        assert_eq!(commits[0].subject, "add thing");
        assert_eq!(commits[0].body_hint, "long body");
        assert!(commits[0].multiline);
        assert_eq!(commits[1].parents, Vec::<String>::new());
        assert!(!commits[1].multiline);
    }
}
