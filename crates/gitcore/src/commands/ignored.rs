pub const ARGS: &[&str] = &["ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--directory", "--no-empty-directory"];

/// Paths relative to the worktree; whole ignored directories end with `/`.
pub fn parse(out: &[u8]) -> Vec<String> {
    out.split(|&b| b == 0)
        .filter(|p| !p.is_empty())
        .map(|p| String::from_utf8_lossy(p).trim_end_matches('/').to_string())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn strips_directory_slashes() {
        assert_eq!(parse(b"tmp/\0build/out.log\0"), ["tmp", "build/out.log"]);
    }
}
