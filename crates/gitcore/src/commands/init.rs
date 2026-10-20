use std::path::Path;

pub fn args(dir: &Path) -> Vec<String> {
    vec!["init".into(), "--".into(), dir.to_string_lossy().into_owned()]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dir_after_separator() {
        assert_eq!(args(Path::new("E:/new repo")), ["init", "--", "E:/new repo"]);
    }
}
