use crate::{config::WorkspaceConfig, registry::RepoEntry};
use futures::future::{try_join_all, BoxFuture};
use gitcore::{commands::gitlinks, GitRunner, RunError};
use std::path::{Path, PathBuf};

struct Found {
    path: PathBuf,
    path_in_parent: Option<String>,
    recorded_sha: Option<String>,
    initialized: bool,
    children: Vec<Found>,
}

pub async fn discover<R: GitRunner + Clone + 'static>(
    runner: &R,
    ws: &WorkspaceConfig,
) -> Result<Vec<RepoEntry>, RunError> {
    let trees = try_join_all(ws.roots.iter().map(|root| {
        walk(runner.clone(), root.path.clone(), None, None, true)
    }))
    .await?;
    let mut repos = Vec::new();
    for tree in trees {
        flatten(&mut repos, ws, tree, None);
    }
    Ok(repos)
}

fn walk<R: GitRunner + Clone + 'static>(
    runner: R,
    path: PathBuf,
    path_in_parent: Option<String>,
    recorded_sha: Option<String>,
    initialized: bool,
) -> BoxFuture<'static, Result<Found, RunError>> {
    Box::pin(async move {
        let mut found = Found { path, path_in_parent, recorded_sha, initialized, children: vec![] };
        if !initialized {
            return Ok(found);
        }
        let out = runner.run_ok(&found.path, gitlinks::ARGS).await?;
        found.children = try_join_all(gitlinks::parse(&out).into_iter().map(|link| {
            let sub = found.path.join(&link.path);
            let initialized = sub.join(".git").exists();
            walk(runner.clone(), sub, Some(link.path), Some(link.recorded_sha), initialized)
        }))
        .await?;
        Ok(found)
    })
}

fn flatten(repos: &mut Vec<RepoEntry>, ws: &WorkspaceConfig, found: Found, parent: Option<u32>) {
    let id = repos.len() as u32;
    repos.push(RepoEntry {
        id,
        parent,
        name: file_name(&found.path),
        excluded: ws.is_excluded(&found.path),
        path: found.path,
        path_in_parent: found.path_in_parent,
        recorded_sha: found.recorded_sha,
        initialized: found.initialized,
    });
    for child in found.children {
        flatten(repos, ws, child, Some(id));
    }
}

fn file_name(p: &Path) -> String {
    p.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| p.to_string_lossy().into_owned())
}
