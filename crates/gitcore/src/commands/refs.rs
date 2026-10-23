use serde::Serialize;

/// Annotated tags deref to their commit through `*objectname` (SPEC §2).
pub const ARGS: &[&str] = &[
    "for-each-ref",
    "--format=%(objectname)%00%(*objectname)%00%(refname)%00%(upstream)%00%(symref)",
    "refs/heads",
    "refs/remotes",
    "refs/tags",
    "refs/notes",
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum RefKind {
    Branch,
    Remote,
    Tag,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitRef {
    pub sha: String,
    pub kind: RefKind,
    pub name: String,
    pub upstream: Option<String>,
}

pub fn parse(out: &[u8]) -> Vec<GitRef> {
    String::from_utf8_lossy(out).lines().filter_map(parse_line).collect()
}

fn parse_line(line: &str) -> Option<GitRef> {
    let mut f = line.split('\0');
    let object = f.next()?;
    let peeled = f.next()?;
    let refname = f.next()?;
    let upstream = f.next().unwrap_or("");
    let (kind, name) = if let Some(n) = refname.strip_prefix("refs/heads/") {
        (RefKind::Branch, n)
    } else if let Some(n) = refname.strip_prefix("refs/remotes/") {
        if n.ends_with("/HEAD") {
            return None;
        }
        (RefKind::Remote, n)
    } else {
        (RefKind::Tag, refname.strip_prefix("refs/tags/")?)
    };
    Some(GitRef {
        sha: if peeled.is_empty() { object } else { peeled }.to_string(),
        kind,
        name: name.to_string(),
        upstream: upstream.strip_prefix("refs/remotes/").map(str::to_string),
    })
}

/// `(remote, branch)` for each `refs/remotes/<remote>/HEAD` symref, `origin` first.
pub fn remote_heads(out: &[u8]) -> Vec<(String, String)> {
    let mut heads: Vec<(String, String)> = String::from_utf8_lossy(out)
        .lines()
        .filter_map(|line| {
            let f: Vec<&str> = line.split('\0').collect();
            let remote = f.get(2)?.strip_prefix("refs/remotes/")?.strip_suffix("/HEAD")?;
            let branch = f.get(4)?.strip_prefix("refs/remotes/")?.strip_prefix(remote)?.strip_prefix('/')?;
            Some((remote.to_string(), branch.to_string()))
        })
        .collect();
    heads.sort_by_key(|(r, _)| r != "origin");
    heads
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_branches_remotes_and_peeled_tags() {
        let out = b"a\0\0refs/heads/main\0refs/remotes/origin/main\n\
b\0\0refs/remotes/origin/main\0\n\
h\0\0refs/remotes/origin/HEAD\0\n\
t\0c\0refs/tags/v1\0\n";
        let refs = parse(out);
        assert_eq!(refs.len(), 3);
        assert_eq!(refs[0].upstream.as_deref(), Some("origin/main"));
        assert_eq!(refs[1].kind, RefKind::Remote);
        assert_eq!(refs[2].sha, "c");
        assert_eq!(refs[2].kind, RefKind::Tag);
    }

    #[test]
    fn remote_heads_put_origin_first() {
        let out = b"h\0\0refs/remotes/up/HEAD\0\0refs/remotes/up/trunk\n\
h\0\0refs/remotes/origin/HEAD\0\0refs/remotes/origin/dev\n\
b\0\0refs/remotes/origin/dev\0\0\n";
        assert_eq!(remote_heads(out), [("origin".into(), "dev".into()), ("up".into(), "trunk".into())]);
    }
}
