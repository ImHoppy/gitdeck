use crate::{RepoEntry, RepoId};
use std::collections::HashMap;

/// Groups repos into waves, deepest submodules first, so a superproject runs after its submodules.
pub fn waves(entries: &[RepoEntry]) -> Vec<Vec<RepoId>> {
    let parents: HashMap<RepoId, Option<RepoId>> = entries.iter().map(|e| (e.id, e.parent)).collect();
    let depth = |mut id: RepoId| {
        let mut d = 0;
        while let Some(Some(p)) = parents.get(&id) {
            id = *p;
            d += 1;
        }
        d
    };
    let mut by_depth: Vec<Vec<RepoId>> = Vec::new();
    for e in entries {
        let d = depth(e.id);
        if by_depth.len() <= d {
            by_depth.resize(d + 1, Vec::new());
        }
        by_depth[d].push(e.id);
    }
    by_depth.reverse();
    by_depth.retain(|w| !w.is_empty());
    by_depth
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(id: RepoId, parent: Option<RepoId>) -> RepoEntry {
        RepoEntry {
            id,
            parent,
            path: format!("r{id}").into(),
            path_in_parent: None,
            name: format!("r{id}"),
            recorded_sha: None,
            initialized: true,
            excluded: false,
        }
    }

    #[test]
    fn submodules_come_before_their_superproject() {
        let entries = [entry(0, None), entry(1, Some(0)), entry(2, Some(1)), entry(3, None)];
        assert_eq!(waves(&entries), vec![vec![2], vec![1], vec![0, 3]]);
    }
}
