/// Makes git read the pathspecs from stdin, so no path list ever hits the command-line length cap.
pub const FROM_STDIN: [&str; 2] = ["--pathspec-from-file=-", "--pathspec-file-nul"];

/// The stdin for `FROM_STDIN`: NUL-separated, so any file name passes untouched.
pub fn stdin(paths: &[String]) -> Vec<u8> {
    let mut out = Vec::new();
    for p in paths {
        out.extend_from_slice(p.as_bytes());
        out.push(0);
    }
    out
}

/// Windows caps a whole command line at 32767 chars; stay well under it with the git prefix and quoting.
const MAX_CHARS: usize = 24_000;

/// Splits paths into batches that each fit on one command line, for commands without `FROM_STDIN`.
pub fn chunks(paths: &[String]) -> Vec<&[String]> {
    let mut out = Vec::new();
    let (mut start, mut len) = (0, 0);
    for (i, p) in paths.iter().enumerate() {
        let n = p.len() + 3;
        if i > start && len + n > MAX_CHARS {
            out.push(&paths[start..i]);
            (start, len) = (i, 0);
        }
        len += n;
    }
    if start < paths.len() {
        out.push(&paths[start..]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nul_separates_paths() {
        assert_eq!(stdin(&["a b".into(), "-x".into()]), b"a b\0-x\0");
    }

    #[test]
    fn splits_long_lists() {
        assert!(chunks(&[]).is_empty());
        let p: Vec<String> = (0..5000).map(|i| format!("clothes/some/longer/path/file_{i}.png")).collect();
        let c = chunks(&p);
        assert!(c.len() > 1);
        assert_eq!(c.iter().map(|c| c.len()).sum::<usize>(), p.len());
        assert!(c.iter().all(|c| c.iter().map(|p| p.len() + 3).sum::<usize>() <= MAX_CHARS));
    }
}
