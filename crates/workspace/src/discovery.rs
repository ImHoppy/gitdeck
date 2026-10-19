use crate::{config::WorkspaceConfig, registry::RepoEntry};
use gitcore::{
    commands::submodule,
    model::{SubmoduleEntry, SubmoduleFlag},
    GitRunner, RunError,
};
use std::path::Path;

pub async fn discover<R: GitRunner>(
    runner: &R,
    ws: &WorkspaceConfig,
) -> Result<Vec<RepoEntry>, RunError> {
    let mut repos = Vec::new();
    for root in &ws.roots {
        let out = runner.run_ok(&root.path, submodule::ARGS).await?;
        add_root(&mut repos, ws, &root.path, &submodule::parse(&out));
    }
    Ok(repos)
}

fn add_root(repos: &mut Vec<RepoEntry>, ws: &WorkspaceConfig, root: &Path, subs: &[SubmoduleEntry]) {
    let root_id = repos.len() as u32;
    repos.push(RepoEntry {
        id: root_id,
        parent: None,
        path: root.to_path_buf(),
        path_in_parent: None,
        name: file_name(root),
        initialized: true,
        pointer_differs: false,
        excluded: ws.is_excluded(root),
    });
    let mut chain: Vec<(String, u32)> = Vec::new();
    for sub in subs {
        while chain
            .last()
            .is_some_and(|(p, _)| !sub.path.starts_with(&format!("{p}/")))
        {
            chain.pop();
        }
        let (parent_path, parent_id) = chain.last().cloned().unwrap_or((String::new(), root_id));
        let rel = if parent_path.is_empty() {
            sub.path.clone()
        } else {
            sub.path[parent_path.len() + 1..].to_string()
        };
        let path = root.join(&sub.path);
        let id = repos.len() as u32;
        repos.push(RepoEntry {
            id,
            parent: Some(parent_id),
            name: file_name(&path),
            excluded: ws.is_excluded(&path),
            path,
            path_in_parent: Some(rel),
            initialized: sub.flag != SubmoduleFlag::Uninitialized,
            pointer_differs: sub.flag == SubmoduleFlag::PointerDiffers,
        });
        chain.push((sub.path.clone(), id));
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
    use gitcore::commands::submodule::parse;

    #[test]
    fn nests_submodules_under_their_parent() {
        let ws = WorkspaceConfig { name: "w".into(), roots: vec![], exclude: Default::default() };
        let subs = parse(b" a cfg\n a res/[s]/ava\n a res/[s]/ava/lib\n-b res/[s]/ui\n");
        let mut repos = Vec::new();
        add_root(&mut repos, &ws, Path::new("/r"), &subs);
        let parents: Vec<_> = repos.iter().map(|r| r.parent).collect();
        assert_eq!(parents, vec![None, Some(0), Some(0), Some(2), Some(0)]);
        assert_eq!(repos[3].path_in_parent.as_deref(), Some("lib"));
        assert!(!repos[4].initialized);
    }
}
