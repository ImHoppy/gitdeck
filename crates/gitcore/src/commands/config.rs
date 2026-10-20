use serde::Deserialize;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Scope {
    Global,
    /// The repository's own `.git/config`.
    Local,
}

impl Scope {
    fn flag(self) -> &'static str {
        match self {
            Scope::Global => "--global",
            Scope::Local => "--local",
        }
    }
}

pub fn list_args(scope: Scope) -> Vec<String> {
    vec!["config".into(), scope.flag().into(), "--list".into(), "-z".into()]
}

/// Setting to "" unsets the key in that scope, so the next scope's value applies again.
pub fn set_args(scope: Scope, key: &str, value: &str) -> Vec<String> {
    if value.is_empty() {
        vec!["config".into(), scope.flag().into(), "--unset-all".into(), key.into()]
    } else {
        vec!["config".into(), scope.flag().into(), "--replace-all".into(), key.into(), value.into()]
    }
}

/// `key\nvalue\0` records; a key set several times keeps its last value, as git reads it.
pub fn parse_list(out: &[u8]) -> BTreeMap<String, String> {
    String::from_utf8_lossy(out)
        .split('\0')
        .filter(|r| !r.is_empty())
        .map(|r| match r.split_once('\n') {
            Some((k, v)) => (k.to_string(), v.to_string()),
            None => (r.to_string(), "true".to_string()),
        })
        .collect()
}

/// git exits 5 when unsetting a key that isn't set: nothing to do, not an error.
pub fn unset_missing(code: i32) -> bool {
    code == 5
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_records() {
        let m = parse_list(b"user.name\nAnn Lee\0core.autocrlf\ninput\0core.bare\0user.name\nAnn\0");
        assert_eq!(m.get("user.name").map(String::as_str), Some("Ann"));
        assert_eq!(m.get("core.autocrlf").map(String::as_str), Some("input"));
        assert_eq!(m.get("core.bare").map(String::as_str), Some("true"));
    }

    #[test]
    fn set_and_unset() {
        assert_eq!(set_args(Scope::Local, "user.email", "a@b"), ["config", "--local", "--replace-all", "user.email", "a@b"]);
        assert_eq!(set_args(Scope::Global, "user.email", ""), ["config", "--global", "--unset-all", "user.email"]);
    }
}
