use gitcore::{
    commands::diff::{ChangeKind, ChangedFile, DiffTarget, PatchOptions},
    GitRunner, ProcessRunner,
};
use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    process::Command,
    sync::atomic::{AtomicU32, Ordering},
};
use workspace::{
    changes,
    stage_lines::{self, LineMode, StageError},
};

struct Repo(PathBuf);

impl Drop for Repo {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn git(cwd: &Path, args: &[&str]) {
    let out = Command::new("git").args(args).current_dir(cwd).output().unwrap();
    assert!(out.status.success(), "git {args:?}: {}", String::from_utf8_lossy(&out.stderr));
}

fn repo(file: &str, committed: &[u8]) -> Repo {
    static N: AtomicU32 = AtomicU32::new(0);
    let dir = std::env::temp_dir().join(format!("gitdeck-lines-{}-{}", std::process::id(), N.fetch_add(1, Ordering::Relaxed)));
    let _ = std::fs::remove_dir_all(&dir);
    std::fs::create_dir_all(&dir).unwrap();
    git(&dir, &["init", "-q"]);
    for (k, v) in [("user.name", "t"), ("user.email", "t@t"), ("core.autocrlf", "false")] {
        git(&dir, &["config", k, v]);
    }
    std::fs::write(dir.join(file), committed).unwrap();
    git(&dir, &["add", "."]);
    git(&dir, &["commit", "-qm", "base"]);
    Repo(dir)
}

fn modified(path: &str) -> ChangedFile {
    ChangedFile { path: path.into(), old_path: None, kind: ChangeKind::Modified }
}

async fn lines_of(r: &ProcessRunner, repo: &Path, target: DiffTarget, file: &ChangedFile, wanted: &[&str]) -> (String, HashSet<usize>) {
    let p = changes::patch(r, repo, &target, file, PatchOptions::default()).await.unwrap();
    let picked = p.text.lines().enumerate().filter(|(_, l)| wanted.contains(&l.trim_end_matches('\r'))).map(|(i, _)| i).collect();
    (p.diff_id, picked)
}

async fn show(r: &ProcessRunner, repo: &Path, args: &[&str]) -> String {
    String::from_utf8(r.run_ok(repo, args).await.unwrap()).unwrap()
}

#[tokio::test]
async fn stages_unstages_and_resets_single_lines() {
    let repo = repo("f.txt", b"one\ntwo\nthree\nfour\n");
    let path = &repo.0;
    let r = ProcessRunner::default();
    std::fs::write(path.join("f.txt"), "one\nTWO\nthree\nFOUR\n").unwrap();
    let f = modified("f.txt");

    let (id, picked) = lines_of(&r, path, DiffTarget::Worktree, &f, &["-two", "+TWO"]).await;
    stage_lines::apply(&r, path, &f, LineMode::Stage, &id, &picked).await.unwrap();
    assert_eq!(show(&r, path, &["show", ":f.txt"]).await, "one\nTWO\nthree\nfour\n");

    let (id, picked) = lines_of(&r, path, DiffTarget::Index, &f, &["+TWO"]).await;
    stage_lines::apply(&r, path, &f, LineMode::Unstage, &id, &picked).await.unwrap();
    assert_eq!(show(&r, path, &["show", ":f.txt"]).await, "one\nthree\nfour\n");

    git(path, &["reset", "-q"]);
    let (id, picked) = lines_of(&r, path, DiffTarget::Worktree, &f, &["-four", "+FOUR"]).await;
    stage_lines::apply(&r, path, &f, LineMode::Reset, &id, &picked).await.unwrap();
    assert_eq!(std::fs::read_to_string(path.join("f.txt")).unwrap(), "one\nTWO\nthree\nfour\n");
}

#[tokio::test]
async fn refuses_a_stale_diff() {
    let repo = repo("f.txt", b"a\n");
    let r = ProcessRunner::default();
    std::fs::write(repo.0.join("f.txt"), "b\n").unwrap();
    let f = modified("f.txt");
    let (_, picked) = lines_of(&r, &repo.0, DiffTarget::Worktree, &f, &["+b"]).await;
    let err = stage_lines::apply(&r, &repo.0, &f, LineMode::Stage, "0000", &picked).await.unwrap_err();
    assert!(matches!(err, StageError::Stale));
}

#[tokio::test]
async fn stages_part_of_an_untracked_file() {
    let repo = repo("keep.txt", b"k\n");
    let r = ProcessRunner::default();
    std::fs::write(repo.0.join("new.txt"), "a\nb\nc\n").unwrap();
    let f = ChangedFile { path: "new.txt".into(), old_path: None, kind: ChangeKind::Untracked };
    let (id, picked) = lines_of(&r, &repo.0, DiffTarget::Worktree, &f, &["+a", "+c"]).await;
    stage_lines::apply(&r, &repo.0, &f, LineMode::Stage, &id, &picked).await.unwrap();
    assert_eq!(show(&r, &repo.0, &["show", ":new.txt"]).await, "a\nc\n");
}

#[tokio::test]
async fn keeps_crlf_and_missing_final_newline() {
    let repo = repo("w.txt", b"one\r\ntwo\r\nend");
    let r = ProcessRunner::default();
    std::fs::write(repo.0.join("w.txt"), "one\r\nTWO\r\nEND").unwrap();
    let f = modified("w.txt");
    let (id, picked) = lines_of(&r, &repo.0, DiffTarget::Worktree, &f, &["-two", "+TWO"]).await;
    stage_lines::apply(&r, &repo.0, &f, LineMode::Stage, &id, &picked).await.unwrap();
    assert_eq!(show(&r, &repo.0, &["show", ":w.txt"]).await, "one\r\nTWO\r\nend");

    let (id, picked) = lines_of(&r, &repo.0, DiffTarget::Worktree, &f, &["-end", "+END"]).await;
    stage_lines::apply(&r, &repo.0, &f, LineMode::Stage, &id, &picked).await.unwrap();
    assert_eq!(show(&r, &repo.0, &["show", ":w.txt"]).await, "one\r\nTWO\r\nEND");
}
