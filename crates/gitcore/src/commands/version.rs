use serde::Serialize;

pub const ARGS: &[&str] = &["--version"];

pub type Version = (u32, u32, u32);

/// `worktree list --porcelain -z`; `--force-if-includes` (2.30) and `--pathspec-from-file` (2.25) come before it.
pub const MINIMUM: Version = (2, 36, 0);

/// CVE-2025-48384: `clone --recurse-submodules` of an untrusted repository can run its code.
pub const PATCHED: Version = (2, 50, 1);

/// Maintenance releases that got the same fix.
const PATCHED_BACKPORTS: [Version; 7] = [(2, 43, 7), (2, 44, 4), (2, 45, 4), (2, 46, 4), (2, 47, 3), (2, 48, 2), (2, 49, 1)];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Support {
    Ok,
    /// Works, but misses the fix for a recursive clone running code.
    Unpatched,
    TooOld,
}

/// `git version 2.55.0.windows.5`, `git version 2.39.2 (Apple Git-143)`.
pub fn parse(out: &[u8]) -> Option<Version> {
    let text = String::from_utf8_lossy(out);
    let number = text.trim().strip_prefix("git version ")?.split_whitespace().next()?;
    let mut parts = number.split('.').map(|p| p.parse::<u32>().ok());
    Some((parts.next()??, parts.next()??, parts.next().flatten().unwrap_or(0)))
}

pub fn support(v: Version) -> Support {
    if v < MINIMUM {
        Support::TooOld
    } else if v >= PATCHED || PATCHED_BACKPORTS.iter().any(|b| v.0 == b.0 && v.1 == b.1 && v.2 >= b.2) {
        Support::Ok
    } else {
        Support::Unpatched
    }
}

pub fn display(v: Version) -> String {
    format!("{}.{}.{}", v.0, v.1, v.2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_real_outputs() {
        assert_eq!(parse(b"git version 2.55.0.windows.5\n"), Some((2, 55, 0)));
        assert_eq!(parse(b"git version 2.39.2 (Apple Git-143)\n"), Some((2, 39, 2)));
        assert_eq!(parse(b"git version 2.43.0\n"), Some((2, 43, 0)));
        assert_eq!(parse(b"git version 2.50\n"), Some((2, 50, 0)));
        assert_eq!(parse(b"git: command not found"), None);
    }

    #[test]
    fn grades_versions() {
        assert_eq!(support((2, 35, 9)), Support::TooOld);
        assert_eq!(support((2, 36, 0)), Support::Unpatched);
        assert_eq!(support((2, 43, 6)), Support::Unpatched);
        assert_eq!(support((2, 43, 7)), Support::Ok);
        assert_eq!(support((2, 49, 0)), Support::Unpatched);
        assert_eq!(support((2, 50, 0)), Support::Unpatched);
        assert_eq!(support((2, 50, 1)), Support::Ok);
        assert_eq!(support((2, 55, 0)), Support::Ok);
        assert_eq!(support((3, 0, 0)), Support::Ok);
    }
}
