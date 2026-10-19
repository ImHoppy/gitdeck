//! Real-git fixtures: an origin, a clone that sync runs in, and a second clone that pushes
//! upstream changes, so pull --rebase and its autostash hit the same conflicts as in daily use.

use gitcore::{model::Operation, GitRunner, ProcessRunner};
use std::{
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, Ordering},
};
use workspace::{
    state,
    sync::{self, RebaseAction, SyncKind, SyncOutcome},
};

struct Fixture {
    root: PathBuf,
    mine: PathBuf,
    theirs: PathBuf,
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.root);
    }
}

fn git(cwd: &Path, args: &[&str]) {
    let out = Command::new("git")
        .args(["-c", "user.name=t", "-c", "user.email=t@t", "-c", "init.defaultBranch=main"])
        .args(args)
        .current_dir(cwd)
        .output()
        .expect("git runs");
    assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
}

fn write(repo: &Path, file: &str, text: &str) {
    std::fs::write(repo.join(file), text).unwrap();
}

fn commit(repo: &Path, file: &str, text: &str) {
    write(repo, file, text);
    git(repo, &["add", file]);
    git(repo, &["-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", file]);
}

/// Both clones start from one shared commit of `a.txt`.
fn fixture() -> Fixture {
    static N: AtomicU32 = AtomicU32::new(0);
    let n = N.fetch_add(1, Ordering::Relaxed);
    let root = std::env::temp_dir().join(format!("gitdeck-sync-{}-{n}", std::process::id()));
    let _ = std::fs::remove_dir_all(&root);
    std::fs::create_dir_all(&root).unwrap();
    git(&root, &["init", "-q", "--bare", "origin.git"]);
    git(&root, &["clone", "-q", "origin.git", "mine"]);
    let mine = root.join("mine");
    for repo in [&mine] {
        git(repo, &["config", "user.name", "t"]);
        git(repo, &["config", "user.email", "t@t"]);
        git(repo, &["config", "core.autocrlf", "false"]);
    }
    commit(&mine, "a.txt", "base\n");
    git(&mine, &["push", "-q", "-u", "origin", "HEAD:main"]);
    git(&root, &["clone", "-q", "origin.git", "theirs"]);
    let theirs = root.join("theirs");
    git(&theirs, &["config", "user.name", "t"]);
    git(&theirs, &["config", "user.email", "t@t"]);
    git(&theirs, &["config", "core.autocrlf", "false"]);
    Fixture { root, mine, theirs }
}

fn upstream_change(f: &Fixture, text: &str) {
    commit(&f.theirs, "a.txt", text);
    git(&f.theirs, &["push", "-q"]);
}

async fn operation(runner: &ProcessRunner, repo: &Path) -> Option<Operation> {
    state::load(runner, repo).await.unwrap().operation
}

#[tokio::test]
async fn sync_rebases_local_commit_and_pushes() {
    let f = fixture();
    let runner = ProcessRunner::default();
    upstream_change(&f, "base\ntheirs\n");
    commit(&f.mine, "b.txt", "mine\n");
    assert_eq!(sync::run(&runner, &f.mine, SyncKind::Sync).await, SyncOutcome::Done);
    let log = runner.run_ok(&f.mine, &["log", "--format=%s", "origin/main"]).await.unwrap();
    assert_eq!(String::from_utf8_lossy(&log).lines().collect::<Vec<_>>(), ["b.txt", "a.txt", "a.txt"]);
}

#[tokio::test]
async fn conflicting_rebase_stops_and_abort_restores() {
    let f = fixture();
    let runner = ProcessRunner::default();
    upstream_change(&f, "theirs\n");
    commit(&f.mine, "a.txt", "mine\n");
    assert_eq!(sync::run(&runner, &f.mine, SyncKind::Sync).await, SyncOutcome::Conflict);
    assert_eq!(operation(&runner, &f.mine).await, Some(Operation::Rebase));
    let conflicts = runner.run_ok(&f.mine, gitcore::commands::conflicts::ARGS).await.unwrap();
    assert_eq!(gitcore::commands::conflicts::parse(&conflicts), ["a.txt"]);

    let skipped = sync::run(&runner, &f.mine, SyncKind::Sync).await;
    assert!(matches!(skipped, SyncOutcome::Skipped { .. }), "{skipped:?}");

    assert_eq!(sync::rebase(&runner, &f.mine, RebaseAction::Abort).await, SyncOutcome::Done);
    assert_eq!(operation(&runner, &f.mine).await, None);
}

#[tokio::test]
async fn resolved_conflict_continues_without_an_editor() {
    let f = fixture();
    let runner = ProcessRunner::default();
    upstream_change(&f, "theirs\n");
    commit(&f.mine, "a.txt", "mine\n");
    sync::run(&runner, &f.mine, SyncKind::Pull).await;
    write(&f.mine, "a.txt", "both\n");
    git(&f.mine, &["add", "a.txt"]);
    assert_eq!(sync::rebase(&runner, &f.mine, RebaseAction::Continue).await, SyncOutcome::Done);
    assert_eq!(operation(&runner, &f.mine).await, None);
}

#[tokio::test]
async fn autostash_conflict_keeps_the_stash_entry() {
    let f = fixture();
    let runner = ProcessRunner::default();
    upstream_change(&f, "theirs\n");
    write(&f.mine, "a.txt", "uncommitted\n");
    assert_eq!(sync::run(&runner, &f.mine, SyncKind::Pull).await, SyncOutcome::AutostashConflict);
    let stashes = runner.run_ok(&f.mine, &["stash", "list"]).await.unwrap();
    assert_eq!(String::from_utf8_lossy(&stashes).lines().count(), 1);
}
