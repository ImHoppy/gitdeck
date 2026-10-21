use gitcore::{
    commands::{
        cat_file,
        diff::{self, ChangeKind, ChangedFile, DiffTarget, PatchOptions},
    },
    GitRunner, RunError,
};
use serde::Serialize;
use std::{
    hash::{DefaultHasher, Hash, Hasher},
    path::Path,
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Patch {
    pub text: String,
    pub diff_id: String,
    pub binary: Option<BinarySizes>,
}

#[derive(Debug, Clone, Serialize)]
pub struct BinarySizes {
    pub old: Option<u64>,
    pub new: Option<u64>,
}

async fn blob_size<R: GitRunner>(runner: &R, path: &Path, blob: Option<&str>) -> Option<u64> {
    let args = cat_file::size_args(blob?);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    cat_file::parse_size(&runner.run_ok(path, &args).await.ok()?)
}

async fn binary_sizes<R: GitRunner>(runner: &R, path: &Path, target: &DiffTarget, file: &ChangedFile, text: &str) -> Option<BinarySizes> {
    let (old, new) = diff::binary_blobs(text)?;
    let old = blob_size(runner, path, old.as_deref()).await;
    let new = if *target == DiffTarget::Worktree && file.kind != ChangeKind::Deleted {
        tokio::fs::metadata(path.join(&file.path)).await.ok().map(|m| m.len())
    } else {
        blob_size(runner, path, new.as_deref()).await
    };
    Some(BinarySizes { old, new })
}

pub async fn files<R: GitRunner>(runner: &R, path: &Path, target: &DiffTarget, content: Option<&str>) -> Result<Vec<ChangedFile>, RunError> {
    let args = diff::files_args(target, content);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    if *target != DiffTarget::Worktree || content.is_some() {
        return Ok(diff::parse_name_status(&runner.run_ok(path, &args).await?));
    }
    // the untracked scan is the slow half on big trees: run it alongside the diff
    let (tracked, untracked) = futures::try_join!(runner.run_ok(path, &args), runner.run_ok(path, diff::UNTRACKED_ARGS))?;
    let mut files = diff::parse_name_status(&tracked);
    files.extend(diff::parse_untracked(&untracked));
    Ok(files)
}

pub async fn patch<R: GitRunner>(
    runner: &R,
    path: &Path,
    target: &DiffTarget,
    file: &ChangedFile,
    opts: PatchOptions,
) -> Result<Patch, RunError> {
    let args = diff::patch_args(target, file, opts);
    let args: Vec<&str> = args.iter().map(String::as_str).collect();
    let out = runner.run(path, &args).await?;
    // `diff --no-index` exits 1 when the files differ
    if out.code > 1 {
        return Err(RunError::Failed { code: out.code, stderr: String::from_utf8_lossy(&out.stderr).trim().to_string() });
    }
    let text = String::from_utf8_lossy(&out.stdout).into_owned();
    let binary = binary_sizes(runner, path, target, file, &text).await;
    Ok(Patch { diff_id: diff_id(&text), text, binary })
}

pub fn diff_id(text: &str) -> String {
    let mut h = DefaultHasher::new();
    text.hash(&mut h);
    format!("{:016x}", h.finish())
}
