use super::pathspec::FROM_STDIN;

/// Throws away unstaged edits of tracked files: the worktree goes back to what is staged.
/// Paths come on stdin (`pathspec::stdin`).
pub fn restore_args() -> Vec<String> {
    let mut a: Vec<String> = ["restore", "--worktree"].map(String::from).to_vec();
    a.extend(FROM_STDIN.map(String::from));
    a
}

/// Deletes untracked files and folders (never ignored ones). `clean` has no `--pathspec-from-file`.
pub fn clean_args(paths: &[String]) -> Vec<String> {
    let mut a: Vec<String> = ["clean", "-f", "-d", "-q", "--"].map(String::from).to_vec();
    a.extend(paths.iter().cloned());
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn paths_after_separator() {
        let p = vec!["a b.txt".to_string(), "-x".to_string()];
        assert_eq!(restore_args(), ["restore", "--worktree", "--pathspec-from-file=-", "--pathspec-file-nul"]);
        assert_eq!(clean_args(&p)[..5], ["clean", "-f", "-d", "-q", "--"]);
    }
}
