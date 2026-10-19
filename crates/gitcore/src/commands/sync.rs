use serde::Serialize;

pub const FETCH_ARGS: &[&str] = &["fetch", "--all", "--prune", "--no-recurse-submodules"];

pub const PULL_ARGS: &[&str] = &[
    "-c",
    "rebase.autoStash=true",
    "pull",
    "--rebase",
    "--autostash",
    "--no-recurse-submodules",
];

pub const PUSH_ARGS: &[&str] = &["push", "--recurse-submodules=check"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SyncOutcome {
    Done,
    UpToDate,
    Conflict,
    AutostashConflict,
    AuthFailed,
    Skipped { reason: String },
    Failed { message: String },
}

pub fn classify(code: i32, stdout: &[u8], stderr: &[u8]) -> SyncOutcome {
    let out = String::from_utf8_lossy(stdout);
    let err = String::from_utf8_lossy(stderr);
    let all = format!("{out}\n{err}");
    if all.contains("Applying autostash resulted in conflicts") {
        return SyncOutcome::AutostashConflict;
    }
    if code == 0 {
        return if all.contains("up to date") || all.contains("Everything up-to-date") {
            SyncOutcome::UpToDate
        } else {
            SyncOutcome::Done
        };
    }
    if all.contains("CONFLICT") || all.contains("could not apply") {
        return SyncOutcome::Conflict;
    }
    if all.contains("Authentication failed")
        || all.contains("Permission denied")
        || all.contains("terminal prompts disabled")
        || all.contains("could not read Username")
    {
        return SyncOutcome::AuthFailed;
    }
    SyncOutcome::Failed { message: err.trim().lines().last().unwrap_or("").to_string() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_outcomes() {
        assert_eq!(classify(0, b"Already up to date.\n", b""), SyncOutcome::UpToDate);
        assert_eq!(classify(0, b"", b"Successfully rebased and updated refs/heads/main.\n"), SyncOutcome::Done);
        assert_eq!(
            classify(1, b"CONFLICT (content): Merge conflict in a.txt\n", b"error: could not apply abc\n"),
            SyncOutcome::Conflict
        );
        assert_eq!(
            classify(0, b"", b"Applying autostash resulted in conflicts.\n"),
            SyncOutcome::AutostashConflict
        );
        assert_eq!(
            classify(128, b"", b"fatal: could not read Username for 'https://x': terminal prompts disabled\n"),
            SyncOutcome::AuthFailed
        );
        assert_eq!(
            classify(1, b"", b"error: boom\nfatal: last line\n"),
            SyncOutcome::Failed { message: "fatal: last line".into() }
        );
    }
}
