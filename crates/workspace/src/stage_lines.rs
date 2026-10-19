use crate::{changes, state::git_dir};
use gitcore::{
    commands::diff::{ChangedFile, DiffTarget},
    GitRunner, RunError,
};
use patch::Direction;
use serde::Deserialize;
use std::{collections::HashSet, path::Path};

/// Same context the client's diff was made with, so line indices line up.
pub const CONTEXT: u32 = 3;

const PATCH_FILE: &str = "gitdeck-lines.patch";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LineMode {
    Stage,
    Unstage,
    Reset,
}

#[derive(Debug, thiserror::Error)]
pub enum StageError {
    #[error("the diff changed since it was shown; select the lines again")]
    Stale,
    #[error("no changed line selected")]
    NothingSelected,
    #[error("git apply refused the patch: {0}")]
    Refused(String),
    #[error(transparent)]
    Git(#[from] RunError),
    #[error("writing the patch: {0}")]
    Io(#[from] std::io::Error),
}

pub async fn apply<R: GitRunner>(
    runner: &R,
    path: &Path,
    file: &ChangedFile,
    mode: LineMode,
    diff_id: &str,
    lines: &HashSet<usize>,
) -> Result<(), StageError> {
    let target = if mode == LineMode::Unstage { DiffTarget::Index } else { DiffTarget::Worktree };
    let fresh = changes::patch(runner, path, &target, file, CONTEXT).await?;
    if fresh.diff_id != diff_id {
        return Err(StageError::Stale);
    }
    let direction = if mode == LineMode::Stage { Direction::Forward } else { Direction::Reverse };
    let text = patch::select(&fresh.text, lines, direction).map_err(|_| StageError::NothingSelected)?;

    let patch_path = git_dir(runner, path).await?.join(PATCH_FILE);
    std::fs::write(&patch_path, text)?;
    let patch_arg = patch_path.to_string_lossy().into_owned();
    let mut args = vec!["apply", "--whitespace=nowarn"];
    match mode {
        LineMode::Stage => args.push("--cached"),
        LineMode::Unstage => args.extend(["--cached", "--reverse"]),
        LineMode::Reset => args.push("--reverse"),
    }
    let check: Vec<&str> = args.iter().copied().chain(["--check", &patch_arg]).collect();
    let checked = runner.run(path, &check).await?;
    if !checked.ok() {
        let _ = std::fs::remove_file(&patch_path);
        return Err(StageError::Refused(String::from_utf8_lossy(&checked.stderr).trim().to_string()));
    }
    let run: Vec<&str> = args.iter().copied().chain([patch_arg.as_str()]).collect();
    let out = runner.run(path, &run).await;
    let _ = std::fs::remove_file(&patch_path);
    let out = out?;
    if !out.ok() {
        return Err(StageError::Refused(String::from_utf8_lossy(&out.stderr).trim().to_string()));
    }
    Ok(())
}
