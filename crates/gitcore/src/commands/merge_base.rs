pub fn args(a: &str, b: &str) -> Vec<String> {
    vec!["merge-base".into(), a.into(), b.into()]
}

pub fn parse(out: &[u8]) -> Option<String> {
    Some(String::from_utf8_lossy(out).trim().to_string()).filter(|s| !s.is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn one_sha() {
        assert_eq!(args("a", "b"), ["merge-base", "a", "b"]);
        assert_eq!(parse(b"abc123
").as_deref(), Some("abc123"));
        assert_eq!(parse(b""), None);
    }
}
