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
        walk(runner.clone(), root.path.clone(), None, None, true, root.nested)
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
    nested: bool,
) -> BoxFuture<'static, Result<Found, RunError>> {
    Box::pin(async move {
        let mut found = Found { path, path_in_parent, recorded_sha, initialized, children: vec![] };
        if !initialized {
            return Ok(found);
        }
        let out = runner.run_ok(&found.path, gitlinks::ARGS).await?;
        let links = gitlinks::parse(&out);
        let mut children: Vec<BoxFuture<'static, Result<Found, RunError>>> = Vec::new();
        for link in &links {
            let sub = found.path.join(&link.path);
            let initialized = sub.join(".git").exists();
            children.push(walk(runner.clone(), sub, Some(link.path.clone()), Some(link.recorded_sha.clone()), initialized, nested));
        }
        if nested {
            let skip: Vec<PathBuf> = links.iter().map(|l| found.path.join(&l.path)).collect();
            for (sub, rel) in nested_repos(&found.path, &skip) {
                // a nested clone records no pointer in its parent, so it never "differs"
                children.push(walk(runner.clone(), sub, Some(rel), None, true, nested));
            }
        }
        found.children = try_join_all(children).await?;
        Ok(found)
    })
}

const NESTED_DEPTH: usize = 3;
const NOT_SCANNED: &[&str] = &[".git", "node_modules", "target", ".venv", "vendor"];

/// Folders under `root` (a few levels down) holding their own `.git`, outside `skip` (submodules);
/// a found repo isn't searched further here: its own walk does that.
fn nested_repos(root: &Path, skip: &[PathBuf]) -> Vec<(PathBuf, String)> {
    let mut found = Vec::new();
    let mut level = vec![root.to_path_buf()];
    for _ in 0..NESTED_DEPTH {
        let mut next = Vec::new();
        for dir in level {
            let Ok(entries) = std::fs::read_dir(&dir) else { continue };
            for entry in entries.flatten() {
                let path = entry.path();
                let name = entry.file_name().to_string_lossy().into_owned();
                if !entry.file_type().is_ok_and(|t| t.is_dir()) || NOT_SCANNED.contains(&name.as_str()) || skip.contains(&path) {
                    continue;
                }
                if path.join(".git").exists() {
                    let rel = path.strip_prefix(root).unwrap_or(&path).to_string_lossy().replace('\\', "/");
                    found.push((path, rel));
                } else {
                    next.push(path);
                }
            }
        }
        level = next;
    }
    found.sort();
    found
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_nested_clones_but_not_inside_them() {
        let root = std::env::temp_dir().join(format!("gitdeck-nested-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        for d in ["a/.git", "a/inner/.git", "group/b/.git", "node_modules/c/.git", "sub/.git", "plain/x"] {
            std::fs::create_dir_all(root.join(d)).unwrap();
        }
        let found: Vec<String> = nested_repos(&root, &[root.join("sub")]).into_iter().map(|(_, rel)| rel).collect();
        assert_eq!(found, ["a", "group/b"]);
        std::fs::remove_dir_all(&root).unwrap();
    }
}
