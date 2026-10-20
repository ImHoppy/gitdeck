/// One `.patch` file per commit in `dir`, named after the subject (git's `0001-subject.patch`).
pub fn format_args(shas: &[String], dir: &str) -> Vec<String> {
    let mut a: Vec<String> = ["format-patch", "--output-directory", dir].map(String::from).to_vec();
    for sha in shas {
        // each commit on its own: `-1 <sha>` keeps a picked set from widening into a range
        a.extend(["-1".into(), sha.clone()]);
    }
    a
}

/// Applies mailbox patches as commits, keeping their authors and messages.
pub fn am_args(files: &[String]) -> Vec<String> {
    let mut a: Vec<String> = ["am", "--3way", "--"].map(String::from).to_vec();
    a.extend(files.iter().cloned());
    a
}

/// The tree of `rev` as a zip file, no `.git` inside.
pub fn archive_args(rev: &str, file: &str) -> Vec<String> {
    ["archive", "--format=zip", "--output", file, rev].map(String::from).to_vec()
}

/// The `.patch` files `format-patch` wrote, one path per line.
pub fn written(stdout: &[u8]) -> Vec<String> {
    String::from_utf8_lossy(stdout).lines().map(str::trim).filter(|l| !l.is_empty()).map(str::to_string).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args() {
        assert_eq!(format_args(&["a".into(), "b".into()], "E:/out"), ["format-patch", "--output-directory", "E:/out", "-1", "a", "-1", "b"]);
        assert_eq!(am_args(&["x.patch".into()]), ["am", "--3way", "--", "x.patch"]);
        assert_eq!(archive_args("HEAD", "E:/a.zip"), ["archive", "--format=zip", "--output", "E:/a.zip", "HEAD"]);
        assert_eq!(written(b"E:/out/0001-a.patch\nE:/out/0002-b.patch\n"), ["E:/out/0001-a.patch", "E:/out/0002-b.patch"]);
    }
}
