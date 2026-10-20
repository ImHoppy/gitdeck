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

/// Narrows the grid like Git Extensions' branch filter and "first parent" toggle.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Hash, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LogOptions {
    /// Only what HEAD reaches, no other branches, remotes or tags.
    #[serde(default)]
    pub current_branch: bool,
    #[serde(default)]
    pub first_parent: bool,
}

pub fn args(opts: LogOptions) -> Vec<String> {
    let mut a: Vec<String> = ARGS.iter().map(|s| s.to_string()).collect();
    if opts.current_branch {
        a.retain(|s| !matches!(s.as_str(), "--branches" | "--remotes" | "--tags"));
    }
    if opts.first_parent {
        let at = a.iter().position(|s| s == "--date-order").map_or(a.len(), |i| i + 1);
        a.insert(at, "--first-parent".into());
    }
    a
}

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

/// Commits whose diff adds or removes `text` (Git Extensions' "diff contains"), newest first.
pub fn content_search_args(text: &str) -> Vec<String> {
    ["log", "--format=%H", "--regexp-ignore-case", "-S", text, "--branches", "--remotes", "--tags", "HEAD"].map(String::from).to_vec()
}

pub fn parse_shas(out: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(out).lines().map(str::trim).filter(|l| !l.is_empty()).map(str::to_string).collect()
}

/// Every commit that changed `path`, following renames, with the file's name in that commit.
pub fn file_history_args(path: &str) -> Vec<String> {
    ["log", "--follow", "--name-only", "-z", "--format=%x1e%H%x1f%P%x1f%aN%x1f%aE%x1f%at%x1f%s", "--", path].map(String::from).to_vec()
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileCommit {
    pub sha: String,
    pub parent: Option<String>,
    pub author: String,
    pub email: String,
    pub time: i64,
    pub subject: String,
    /// The file's path in this commit (it changes across renames).
    pub path: String,
}

pub fn parse_file_history(out: &[u8]) -> Vec<FileCommit> {
    String::from_utf8_lossy(out)
        .split('\x1e')
        .filter_map(|rec| {
            let (head, rest) = rec.split_once('\n').unwrap_or((rec, ""));
            let mut f = head.split('\x1f');
            let sha = f.next()?.to_string();
            let parent = f.next()?.split(' ').find(|p| !p.is_empty()).map(str::to_string);
            let (author, email) = (f.next()?.to_string(), f.next()?.to_string());
            let time = f.next()?.parse().ok()?;
            // with -z the subject line ends with the NUL that separates it from the file names
            let subject = f.next().unwrap_or("").trim_end_matches(|c: char| c.is_control()).to_string();
            let path = rest.split('\0').map(|p| p.trim_matches('\n')).find(|p| !p.is_empty())?.to_string();
            Some(FileCommit { sha, parent, author, email, time, subject, path })
        })
        .collect()
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
    let f: Vec<&str> = text.splitn(9, '\x1f').collect();
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
        let d = parse_details(b"abc\x1fAnn\x1fa@x\x1f10\x1fBob\x1fb@x\x1f20\x1fp1 p2\x1fsubject

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

    #[test]
    fn content_search_keeps_the_text_as_one_argument() {
        let args = content_search_args("fn main() {");
        assert_eq!(&args[..5], ["log", "--format=%H", "--regexp-ignore-case", "-S", "fn main() {"]);
        assert_eq!(parse_shas(b"aa
bb

"), ["aa", "bb"]);
    }

    #[test]
    fn file_history_records() {
        let out = b"\x1eaaa\x1fp1\x1fAnn\x1fann@x\x1f100\x1frename it

new/name.rs\0\x1ebbb\x1f\x1fAnn\x1fann@x\x1f50\x1fstart

old.rs\0";
        let h = parse_file_history(out);
        assert_eq!(h.len(), 2);
        assert_eq!((h[0].sha.as_str(), h[0].parent.as_deref(), h[0].path.as_str()), ("aaa", Some("p1"), "new/name.rs"));
        assert_eq!((h[1].parent.as_deref(), h[1].path.as_str(), h[1].subject.as_str()), (None, "old.rs", "start"));
    }

    #[test]
    fn options_narrow_the_log() {
        let a = args(LogOptions { current_branch: true, first_parent: true });
        assert!(!a.iter().any(|s| s == "--branches" || s == "--remotes" || s == "--tags"));
        assert!(a.iter().any(|s| s == "--first-parent"));
        assert_eq!(a.last().map(String::as_str), Some("HEAD"));
        assert_eq!(args(LogOptions::default()), ARGS);
    }
}
