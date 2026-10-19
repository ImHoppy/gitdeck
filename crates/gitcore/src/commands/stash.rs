use serde::Serialize;

pub const LIST_ARGS: &[&str] = &["stash", "list", "-z", "--format=%gd%x1f%H%x1f%ct%x1f%gs"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stash {
    pub index: u32,
    pub sha: String,
    pub time: i64,
    pub message: String,
}

pub fn parse(out: &[u8]) -> Vec<Stash> {
    String::from_utf8_lossy(out)
        .split('\0')
        .filter_map(|rec| {
            let mut f = rec.trim_start_matches('\n').splitn(4, '\x1f');
            let selector = f.next()?;
            let index = selector.strip_prefix("stash@{")?.strip_suffix('}')?.parse().ok()?;
            Some(Stash {
                index,
                sha: f.next()?.to_string(),
                time: f.next()?.parse().ok()?,
                message: f.next().unwrap_or("").to_string(),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stash_list() {
        let out = b"stash@{0}\x1faaa\x1f1700000000\x1fOn main: wip\0stash@{1}\x1fbbb\x1f1600000000\x1fautostash\0";
        let s = parse(out);
        assert_eq!(s.len(), 2);
        assert_eq!(s[1], Stash { index: 1, sha: "bbb".into(), time: 1600000000, message: "autostash".into() });
    }
}
