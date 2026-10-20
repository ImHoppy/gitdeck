use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Mark {
    Good,
    Bad,
    Skip,
}

pub fn start_args() -> Vec<String> {
    vec!["bisect".into(), "start".into()]
}

pub fn mark_args(mark: Mark, sha: &str) -> Vec<String> {
    let word = match mark {
        Mark::Good => "good",
        Mark::Bad => "bad",
        Mark::Skip => "skip",
    };
    vec!["bisect".into(), word.into(), sha.into()]
}

pub fn reset_args() -> Vec<String> {
    vec!["bisect".into(), "reset".into()]
}

/// The line that says where the search is: "Bisecting: 3 revisions left…" or "<sha> is the first bad commit".
pub fn summary(stdout: &[u8]) -> Option<String> {
    String::from_utf8_lossy(stdout)
        .lines()
        .find(|l| l.starts_with("Bisecting:") || l.contains("is the first bad commit") || l.starts_with("There are only"))
        .map(str::to_string)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_lines() {
        assert_eq!(summary(b"Bisecting: 2 revisions left to test after this (roughly 1 step)\n[abc] x\n").as_deref(), Some("Bisecting: 2 revisions left to test after this (roughly 1 step)"));
        assert_eq!(summary(b"abc123 is the first bad commit\ncommit abc123\n").as_deref(), Some("abc123 is the first bad commit"));
        assert_eq!(summary(b"status: waiting for both good and bad commits\n"), None);
    }
}
