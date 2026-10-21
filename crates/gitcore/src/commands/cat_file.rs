pub fn size_args(object: &str) -> Vec<String> {
    vec!["cat-file".into(), "-s".into(), object.into()]
}

pub fn parse_size(out: &[u8]) -> Option<u64> {
    String::from_utf8_lossy(out).trim().parse().ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_size() {
        assert_eq!(parse_size(b"143179\n"), Some(143179));
        assert_eq!(parse_size(b""), None);
    }
}
