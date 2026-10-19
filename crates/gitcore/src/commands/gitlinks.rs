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
}
