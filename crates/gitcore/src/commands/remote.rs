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

/// A repository on github.com, the `owner/name` of its URL.
#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct GithubRepo {
    pub owner: String,
    pub name: String,
}

impl GithubRepo {
    pub fn slug(&self) -> String {
        format!("{}/{}", self.owner, self.name)
    }

    /// GitHub ignores case in owner and repo names.
    pub fn is(&self, other: &GithubRepo) -> bool {
        self.owner.eq_ignore_ascii_case(&other.owner) && self.name.eq_ignore_ascii_case(&other.name)
    }

    pub fn parse_slug(slug: &str) -> Option<Self> {
        let (owner, name) = slug.split_once('/')?;
        let valid = |s: &str| !s.is_empty() && s.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
        (valid(owner) && valid(name)).then(|| Self { owner: owner.into(), name: name.into() })
    }
}

/// `https://github.com/o/r.git`, `ssh://git@github.com:22/o/r`, `git@github.com:o/r.git`, and SSH
/// host aliases such as `git@github.com-work:o/r` (one key per account).
pub fn github_repo(url: &str) -> Option<GithubRepo> {
    let url = url.trim();
    let (host, path) = match url.split_once("://") {
        Some((_, rest)) => {
            let (authority, path) = rest.split_once('/')?;
            (authority.rsplit('@').next()?.split(':').next()?, path)
        }
        None => {
            let (authority, path) = url.split_once(':')?;
            (authority.rsplit('@').next()?, path)
        }
    };
    let host = host.to_ascii_lowercase();
    let github = matches!(host.as_str(), "github.com" | "www.github.com" | "ssh.github.com") || host.starts_with("github.com-");
    if !github {
        return None;
    }
    let path = path.trim_matches('/');
    let path = path.strip_suffix(".git").unwrap_or(path);
    GithubRepo::parse_slug(path)
}

/// A clone URL for `repo` in the same style (HTTPS or SSH) as `like`, so the same credentials work.
pub fn github_url(repo: &GithubRepo, like: &str) -> String {
    if like.trim_start().starts_with("http") {
        format!("https://github.com/{}.git", repo.slug())
    } else {
        format!("git@github.com:{}.git", repo.slug())
    }
}

/// The GitHub repo behind `origin`, else behind the first remote on GitHub.
pub fn github_remote(remotes: &[Remote]) -> Option<(String, GithubRepo)> {
    let on_github = |r: &Remote| github_repo(&r.fetch_url).map(|g| (r.name.clone(), g));
    remotes.iter().find(|r| r.name == "origin").and_then(on_github).or_else(|| remotes.iter().find_map(on_github))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn github_urls_of_every_form() {
        let r = |owner: &str, name: &str| Some(GithubRepo { owner: owner.into(), name: name.into() });
        assert_eq!(github_repo("https://github.com/AvaCreation/ui.git"), r("AvaCreation", "ui"));
        assert_eq!(github_repo("https://user@github.com/a/b/"), r("a", "b"));
        assert_eq!(github_repo("http://www.github.com/a/b"), r("a", "b"));
        assert_eq!(github_repo("git@github.com:ImHoppy/gitdeck.git"), r("ImHoppy", "gitdeck"));
        assert_eq!(github_repo("ssh://git@github.com:22/a/b.git"), r("a", "b"));
        assert_eq!(github_repo("ssh://git@ssh.github.com:443/a/b.git"), r("a", "b"));
        assert_eq!(github_repo("git@github.com-work:a/b.git"), r("a", "b"));
        assert_eq!(github_repo("git://github.com/a/my.repo.git"), r("a", "my.repo"));
    }

    #[test]
    fn other_hosts_and_paths_are_not_github() {
        assert_eq!(github_repo("https://gitlab.com/a/b.git"), None);
        assert_eq!(github_repo("https://github.com.evil.io/a/b"), None);
        assert_eq!(github_repo("E:/repos/a"), None);
        assert_eq!(github_repo("https://github.com/a"), None);
        assert_eq!(github_repo("https://github.com/a/b/c"), None);
        assert_eq!(github_repo("/home/me/github.com:a/b"), None);
    }

    #[test]
    fn origin_wins_over_other_github_remotes() {
        let remote = |name: &str, url: &str| Remote { name: name.into(), fetch_url: url.into(), push_url: url.into() };
        let remotes = [remote("upstream", "git@github.com:up/x.git"), remote("origin", "https://github.com/me/x")];
        assert_eq!(github_remote(&remotes).map(|(n, g)| (n, g.slug())), Some(("origin".into(), "me/x".into())));
        let remotes = [remote("origin", "E:/x"), remote("hub", "git@github.com:up/x.git")];
        assert_eq!(github_remote(&remotes).map(|(n, _)| n), Some("hub".into()));
        assert!(GithubRepo::parse_slug("Up/X").unwrap().is(&GithubRepo::parse_slug("up/x").unwrap()));
        let fork = GithubRepo::parse_slug("alice/x").unwrap();
        assert_eq!(github_url(&fork, "https://github.com/me/x"), "https://github.com/alice/x.git");
        assert_eq!(github_url(&fork, "git@github.com:me/x.git"), "git@github.com:alice/x.git");
    }

    #[test]
    fn fetch_and_push_urls() {
        let out = b"origin\thttps://x/a.git (fetch)\norigin\tgit@x:a.git (push)\nfork\tE:/repos/a (fetch)\nfork\tE:/repos/a (push)\n";
        let r = parse(out);
        assert_eq!(r.len(), 2);
        assert_eq!((r[0].fetch_url.as_str(), r[0].push_url.as_str()), ("https://x/a.git", "git@x:a.git"));
        assert_eq!(r[1].name, "fork");
    }
}
