use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub const STATUS_ARGS: &[&str] = &["auth", "status", "--json", "hosts"];

pub const TOKEN_ARGS: &[&str] = &["auth", "token"];

pub const HOST: &str = "github.com";

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum GhAvailability {
    Ready { login: String },
    /// gh runs but has no working login for github.com: `gh auth login` on the host.
    LoggedOut,
    /// No `gh` on the host's PATH.
    Missing,
    Failed { message: String },
}

#[derive(Deserialize)]
struct Status {
    hosts: HashMap<String, Vec<Account>>,
}

#[derive(Deserialize)]
struct Account {
    state: String,
    #[serde(default)]
    active: bool,
    #[serde(default)]
    login: String,
}

pub fn parse(out: &[u8]) -> GhAvailability {
    let status: Status = match serde_json::from_slice(out) {
        Ok(s) => s,
        Err(e) => return GhAvailability::Failed { message: format!("gh auth status: {e}") },
    };
    status
        .hosts
        .get(HOST)
        .and_then(|accounts| accounts.iter().find(|a| a.active && a.state == "success"))
        .map_or(GhAvailability::LoggedOut, |a| GhAvailability::Ready { login: a.login.clone() })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn logged_in_account() {
        assert_eq!(parse(include_bytes!("testdata/auth.json")), GhAvailability::Ready { login: "octocat".into() });
    }

    #[test]
    fn no_host_or_a_broken_token_is_logged_out() {
        assert_eq!(parse(br#"{"hosts":{}}"#), GhAvailability::LoggedOut);
        let expired = br#"{"hosts":{"github.com":[{"state":"error","active":true,"host":"github.com","login":"a"}]}}"#;
        assert_eq!(parse(expired), GhAvailability::LoggedOut);
        assert!(matches!(parse(b"not json"), GhAvailability::Failed { .. }));
    }
}
