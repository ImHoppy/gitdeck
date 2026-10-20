use crate::model::{SubmoduleEntry, SubmoduleFlag};

pub const ARGS: &[&str] = &["--no-optional-locks", "submodule", "status", "--recursive"];

pub const UPDATE_ARGS: &[&str] = &["submodule", "update", "--init", "--recursive"];

pub fn parse(out: &[u8]) -> Vec<SubmoduleEntry> {
    String::from_utf8_lossy(out)
        .lines()
        .filter_map(|line| {
            let flag = match line.chars().next()? {
                ' ' => SubmoduleFlag::UpToDate,
                '-' => SubmoduleFlag::Uninitialized,
                '+' => SubmoduleFlag::PointerDiffers,
                'U' => SubmoduleFlag::Conflict,
                _ => return None,
            };
            let (sha, path) = line[1..].split_once(' ')?;
            let path = match path.rfind(" (") {
                Some(i) if path.ends_with(')') => &path[..i],
                _ => path,
            };
            Some(SubmoduleEntry {
                sha: sha.to_string(),
                path: path.replace('\\', "/"),
                flag,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_and_describe() {
        let out = b" aaa cfg (heads/main)\n-bbb resources/[x]\n+ccc resources/[scripts]/ui (v1-2-gccc)\nUddd a b\n";
        let v = parse(out);
        assert_eq!(v.len(), 4);
        assert_eq!(v[0].path, "cfg");
        assert_eq!(v[1].flag, SubmoduleFlag::Uninitialized);
        assert_eq!(v[2].path, "resources/[scripts]/ui");
        assert_eq!(v[2].flag, SubmoduleFlag::PointerDiffers);
        assert_eq!(v[3].path, "a b");
    }
}
