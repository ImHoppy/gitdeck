use gitcore::{commands::sync::SyncOutcome, ProcessRunner};
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, Ordering},
};
use workspace::{
    pr_branch::PrHead,
    pr_switch::{switch, switch_back, SwitchOutcome, SwitchRequest},
};

struct Fixture {
    root: PathBuf,
    mine: PathBuf,
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn git(cwd: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main", "-c", "core.autocrlf=false"])
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("git runs");
    assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

fn commit(repo: &Path, file: &str, text: &str) {
    std::fs::write(repo.join(file), text).unwrap();
    git(repo, &["add", file]);
    git(repo, &["commit", "-qm", file]);
}

/// `origin` has `main`, a `feat` branch (a same-repo PR) and `refs/pull/7/head` (a fork's PR).
fn fixture() -> Fixture {
    static N: AtomicU32 = AtomicU32::new(0);
    let root = std::env::temp_dir().join(format!("gitdeck-prswitch-{}-{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    git(&root, &["init", "-q", "--bare", "origin.git"]);
    git(&root, &["clone", "-q", "origin.git", "author"]);
    let author = root.join("author");
    commit(&author, "a.txt", "base\n");
    git(&author, &["push", "-q", "origin", "HEAD:main"]);
    git(&author, &["switch", "-q", "-c", "feat"]);
    commit(&author, "b.txt", "feature\n");
    git(&author, &["push", "-q", "origin", "feat"]);
    commit(&author, "c.txt", "from a fork\n");
    git(&author, &["push", "-q", "origin", "HEAD:refs/pull/7/head"]);
    git(&root, &["clone", "-q", "origin.git", "mine"]);
    let mine = root.join("mine");
    // the switch runs git with the machine's own config: Windows CI checks out CRLF otherwise
    git(&mine, &["config", "core.autocrlf", "false"]);
    Fixture { root, mine }
}

fn request(fork: bool, stash: bool) -> SwitchRequest {
    SwitchRequest {
        pr: PrHead { number: 7, head_ref_name: "feat".into(), is_cross_repository: fork, maintainer_can_modify: false, head_repo: None },
        remote: "origin".into(),
        fork_url: None,
        choice: None,
        stash,
    }
}

#[tokio::test]
async fn tracks_a_branch_of_the_same_repo() {
    let f = fixture();
    let runner = ProcessRunner::default();
    let out = switch(&runner, &f.mine, &request(false, false)).await;
    assert_eq!(out, SwitchOutcome::Switched { branch: "feat".into(), previous: Some("main".into()), stash: None });
    assert_eq!(git(&f.mine, &["rev-parse", "--abbrev-ref", "feat@{upstream}"]), "origin/feat");
}

#[tokio::test]
async fn asks_before_stashing_and_brings_the_changes_back() {
    let f = fixture();
    let runner = ProcessRunner::default();
    std::fs::write(f.mine.join("a.txt"), "edited\n").unwrap();
    assert_eq!(switch(&runner, &f.mine, &request(false, false)).await, SwitchOutcome::Dirty);
    assert_eq!(git(&f.mine, &["branch", "--show-current"]), "main");
    let SwitchOutcome::Switched { previous, stash, .. } = switch(&runner, &f.mine, &request(false, true)).await else { panic!("not switched") };
    assert_eq!(std::fs::read_to_string(f.mine.join("a.txt")).unwrap(), "base\n");
    let back = switch_back(&runner, &f.mine, &previous.unwrap(), stash.as_deref()).await;
    assert_eq!(back, SyncOutcome::Done);
    assert_eq!(git(&f.mine, &["branch", "--show-current"]), "main");
    assert_eq!(std::fs::read_to_string(f.mine.join("a.txt")).unwrap(), "edited\n");
    assert_eq!(git(&f.mine, &["stash", "list"]), "");
}

#[tokio::test]
async fn a_fork_lands_on_its_own_branch_from_refs_pull() {
    let f = fixture();
    let runner = ProcessRunner::default();
    let out = switch(&runner, &f.mine, &request(true, false)).await;
    assert!(matches!(&out, SwitchOutcome::Switched { branch, .. } if branch == "pr/7-feat"), "{out:?}");
    assert_eq!(git(&f.mine, &["rev-parse", "HEAD"]), git(&f.mine, &["rev-parse", "origin/pr/7"]));
    assert!(std::fs::metadata(f.mine.join("c.txt")).is_ok());
}
