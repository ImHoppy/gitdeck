pub const ARGS: &[&str] = &["ls-files", "--stage", "-z"];

const GITLINK_MODE: &str = "160000";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Gitlink {
    pub recorded_sha: String,
    pub path: String,
}

pub fn parse(out: &[u8]) -> Vec<Gitlink> {
    out.split(|&b| b == 0)
        .filter_map(|rec| {
            let rec = std::str::from_utf8(rec).ok()?;
            let (meta, path) = rec.split_once('\t')?;
            let mut fields = meta.split(' ');
            if fields.next()? != GITLINK_MODE {
                return None;
            }
            Some(Gitlink { recorded_sha: fields.next()?.to_string(), path: path.to_string() })
        })
        .collect()
}

/// Paths whose recorded submodule commit changed or appeared between two listings.
pub fn moved(before: &[Gitlink], after: &[Gitlink]) -> Vec<String> {
    after.iter().filter(|a| !before.contains(a)).map(|a| a.path.clone()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_only_gitlinks() {
        let out = b"100644 aaa 0\tfile.txt\x00160000 bbb 0\tres/[s]/ui\x00";
        assert_eq!(
            parse(out),
            vec![Gitlink { recorded_sha: "bbb".into(), path: "res/[s]/ui".into() }]
        );
    }

    #[test]
    fn moved_lists_changed_and_new_pointers() {
        let link = |sha: &str, path: &str| Gitlink { recorded_sha: sha.into(), path: path.into() };
        let before = [link("a", "x"), link("b", "y")];
        let after = [link("a", "x"), link("c", "y"), link("d", "z")];
        assert_eq!(moved(&before, &after), ["y", "z"]);
    }
}
