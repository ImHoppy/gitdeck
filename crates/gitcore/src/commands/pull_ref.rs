//! `refs/pull/<n>/head`: GitHub publishes every PR's head there, so plain git can fetch, diff
//! and check out a PR, even one from a fork, with no API call.

pub fn local_ref(remote: &str, number: u64) -> String {
    format!("refs/remotes/{remote}/pr/{number}")
}

pub fn fetch_args(remote: &str, number: u64) -> Vec<String> {
    vec![
        "fetch".into(),
        "--no-recurse-submodules".into(),
        remote.into(),
        format!("+refs/pull/{number}/head:{}", local_ref(remote, number)),
    ]
}

/// The PR head and its base branch in one fetch, both needed for the `base...head` diff.
pub fn fetch_with_base_args(remote: &str, number: u64, base: &str) -> Vec<String> {
    let mut a = fetch_args(remote, number);
    a.push(format!("+refs/heads/{base}:refs/remotes/{remote}/{base}"));
    a
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetches_the_pr_head_into_a_remote_ref() {
        assert_eq!(
            fetch_args("origin", 128),
            ["fetch", "--no-recurse-submodules", "origin", "+refs/pull/128/head:refs/remotes/origin/pr/128"]
        );
    }
}
