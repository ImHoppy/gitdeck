use std::path::Path;

/// `--recurse-submodules`: a workspace shows submodules, so they come along like in Git Extensions' default.
pub fn args(url: &str, dir: &Path) -> Vec<String> {
    vec!["clone".into(), "--progress".into(), "--recurse-submodules".into(), "--".into(), url.into(), dir.to_string_lossy().into_owned()]
}

/// The folder `git clone` would pick: the last URL segment without `.git`.
pub fn default_dir_name(url: &str) -> String {
    let last = url.trim_end_matches(['/', '\\']).rsplit(['/', '\\', ':']).next().unwrap_or("");
    last.strip_suffix(".git").unwrap_or(last).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn url_before_dir_after_separator() {
        assert_eq!(
            args("https://example.com/a.git", Path::new("E:/a")),
            ["clone", "--progress", "--recurse-submodules", "--", "https://example.com/a.git", "E:/a"]
        );
    }

    #[test]
    fn dir_name_from_urls() {
        assert_eq!(default_dir_name("https://github.com/gitextensions/gitextensions.git"), "gitextensions");
        assert_eq!(default_dir_name("git@github.com:me/tool.git/"), "tool");
        assert_eq!(default_dir_name(r"E:\repos\local"), "local");
    }
}
