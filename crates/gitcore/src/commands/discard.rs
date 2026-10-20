/// Throws away unstaged edits of tracked files: the worktree goes back to what is staged.
pub fn restore_args(paths: &[String]) -> Vec<String> {
    let mut a: Vec<String> = ["restore", "--worktree", "--"].map(String::from).to_vec();
    a.extend(paths.iter().cloned());
    a
}

/// Deletes untracked files and folders (never ignored ones).
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
        assert_eq!(restore_args(&p), ["restore", "--worktree", "--", "a b.txt", "-x"]);
        assert_eq!(clean_args(&p)[..5], ["clean", "-f", "-d", "-q", "--"]);
    }
}
