pub const LIST_ARGS: &[&str] = &["remote", "-v"];

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    pub name: String,
    pub fetch_url: String,
    pub push_url: String,
}

/// `origin\turl (fetch)` / `origin\turl (push)` lines, one remote per name in listed order.
pub fn parse(out: &[u8]) -> Vec<Remote> {
    let mut remotes: Vec<Remote> = Vec::new();
    for line in String::from_utf8_lossy(out).lines() {
        let Some((name, rest)) = line.split_once('\t') else { continue };
        let (url, kind) = rest.rsplit_once(' ').unwrap_or((rest, "(fetch)"));
        let i = match remotes.iter().position(|r| r.name == name) {
            Some(i) => i,
            None => {
                remotes.push(Remote { name: name.into(), fetch_url: String::new(), push_url: String::new() });
                remotes.len() - 1
            }
        };
        if kind == "(push)" {
            remotes[i].push_url = url.into();
        } else {
            remotes[i].fetch_url = url.into();
        }
    }
    remotes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetch_and_push_urls() {
        let out = b"origin\thttps://x/a.git (fetch)\norigin\tgit@x:a.git (push)\nfork\tE:/repos/a (fetch)\nfork\tE:/repos/a (push)\n";
        let r = parse(out);
        assert_eq!(r.len(), 2);
        assert_eq!((r[0].fetch_url.as_str(), r[0].push_url.as_str()), ("https://x/a.git", "git@x:a.git"));
        assert_eq!(r[1].name, "fork");
    }
}
