use crate::model::StatusCounts;

pub const ARGS: &[&str] = &[
    "--no-optional-locks",
    "status",
    "--porcelain=2",
    "-z",
    "--untracked-files=normal",
    "--ignore-submodules=all",
];

pub fn parse(out: &[u8]) -> StatusCounts {
    let mut c = StatusCounts::default();
    let mut recs = out.split(|&b| b == 0);
    while let Some(rec) = recs.next() {
        match rec.first() {
            Some(b'1') | Some(b'2') => {
                let xy = rec.get(2..4).unwrap_or(b"..");
                if xy[0] != b'.' {
                    c.staged += 1;
                }
                if xy[1] != b'.' {
                    c.unstaged += 1;
                }
                if rec[0] == b'2' {
                    recs.next();
                }
            }
            Some(b'u') => c.conflicts += 1,
            Some(b'?') => c.untracked += 1,
            _ => {}
        }
    }
    c
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_each_kind() {
        let out = b"1 M. N... 100644 100644 100644 a b f1\x001 .M N... 100644 100644 100644 a b f2\x002 R. N... 100644 100644 100644 a b R100 new\x00old\x00u UU N... 1 1 1 1 a b c f3\x00? new.txt\x00";
        let c = parse(out);
        assert_eq!(
            c,
            StatusCounts { staged: 2, unstaged: 1, untracked: 1, conflicts: 1 }
        );
    }
}
