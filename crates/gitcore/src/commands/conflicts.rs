pub const ARGS: &[&str] = &["diff", "--name-only", "--diff-filter=U", "-z"];

pub fn parse(out: &[u8]) -> Vec<String> {
    out.split(|&b| b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).into_owned())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_nul_separated_paths() {
        assert_eq!(parse(b"a.txt\x00dir/b c.txt\x00"), ["a.txt", "dir/b c.txt"]);
        assert!(parse(b"").is_empty());
    }
}
