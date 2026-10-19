use serde::Serialize;

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

pub fn details_args(sha: &str) -> Vec<String> {
    let format = "--format=%H%x1f%an%x1f%ae%x1f%at%x1f%cn%x1f%ce%x1f%ct%x1f%P%x1f%B";
    vec!["show".into(), "-s".into(), format.into(), sha.into()]
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CommitDetails {
    pub sha: String,
    pub author: String,
    pub author_email: String,
    pub author_time: i64,
    pub committer: String,
    pub committer_email: String,
    pub commit_time: i64,
    pub parents: Vec<String>,
    pub message: String,
}

pub fn parse_details(out: &[u8]) -> Option<CommitDetails> {
    let text = String::from_utf8_lossy(out);
    let f: Vec<&str> = text.splitn(9, '').collect();
    let [sha, author, author_email, at, committer, committer_email, ct, parents, message] = f.as_slice() else {
        return None;
    };
    Some(CommitDetails {
        sha: sha.trim().into(),
        author: (*author).into(),
        author_email: (*author_email).into(),
        author_time: at.parse().ok()?,
        committer: (*committer).into(),
        committer_email: (*committer_email).into(),
        commit_time: ct.parse().ok()?,
        parents: parents.split(' ').filter(|p| !p.is_empty()).map(str::to_string).collect(),
        message: message.trim_end().into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_details() {
        let d = parse_details(b"abcAnna@x10Bobb@x20p1 p2subject

body

").unwrap();
        assert_eq!(d.parents, ["p1", "p2"]);
        assert_eq!(d.message, "subject

body");
        assert_eq!(d.commit_time, 20);
    }

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
