//! The GitHub CLI: one module per `gh` command, its arguments and the parser of its `--json`.
//! Every command names the repo with `-R`, so gh never guesses it from the folder's remotes.

pub mod auth;
pub mod checks;
pub mod graphql;
pub mod issue;
pub mod label_list;
pub mod pr_checks;
pub mod pr_comment;
pub mod pr_create;
pub mod pr_edit;
pub mod pr_list;
pub mod pr_merge;
pub mod pr_query;
pub mod pr_state;
pub mod pr_view;
pub mod repo_view;
pub mod timeline;

use super::remote::GithubRepo;
use serde::Deserialize;

pub fn repo_flag(repo: &GithubRepo) -> [String; 2] {
    ["-R".into(), repo.slug()]
}

/// Read from stdin, so a long body never hits the command line limit.
pub const BODY_FROM_STDIN: [&str; 2] = ["--body-file", "-"];

#[derive(Debug, Default, Deserialize)]
pub(crate) struct Actor {
    #[serde(default)]
    login: String,
}

/// A deleted account comes back as null; GitHub shows it as `ghost`.
pub(crate) fn login(actor: Option<Actor>) -> String {
    actor.map(|a| a.login).filter(|l| !l.is_empty()).unwrap_or_else(|| "ghost".into())
}

/// `--attach <file>#<alt>` for each picture, as `gh pr comment|create|edit` take them.
pub fn attach_args(files: &[String]) -> Vec<String> {
    files.iter().flat_map(|f| ["--attach".to_string(), f.clone()]).collect()
}
