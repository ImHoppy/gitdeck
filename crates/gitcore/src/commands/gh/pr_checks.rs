use super::repo_flag;
use crate::commands::remote::GithubRepo;
use serde::{Deserialize, Serialize};

const FIELDS: &str = "name,state,bucket,link,workflow,description,startedAt,completedAt,event";

pub fn args(repo: &GithubRepo, number: u64) -> Vec<String> {
    let mut a = vec!["pr".to_string(), "checks".into(), number.to_string()];
    a.extend(repo_flag(repo));
    a.extend(["--json".into(), FIELDS.into()]);
    a
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrCheck {
    pub name: String,
    pub state: String,
    /// `pass`, `fail`, `pending`, `skipping` or `cancel`.
    pub bucket: String,
    #[serde(default)]
    pub link: String,
    #[serde(default)]
    pub workflow: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub started_at: Option<String>,
    #[serde(default)]
    pub completed_at: Option<String>,
}

/// gh exits 8 while checks are pending and 1 when one failed, with the JSON printed either way;
/// a PR with no checks at all prints only a message on stderr.
pub fn parse(out: &[u8]) -> Result<Vec<PrCheck>, serde_json::Error> {
    if out.iter().all(u8::is_ascii_whitespace) {
        return Ok(Vec::new());
    }
    serde_json::from_slice(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn real_checks() {
        let checks = parse(include_bytes!("testdata/pr_checks.json")).unwrap();
        assert!(checks.len() > 3);
        assert_eq!(checks[0].name, "CodeQL");
        assert_eq!(checks[0].bucket, "pass");
        assert!(checks[1].link.starts_with("https://github.com/"));
        assert!(parse(b"").unwrap().is_empty());
    }
}
