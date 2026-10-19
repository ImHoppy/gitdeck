use crate::model::Head;

pub const SYMBOLIC_ARGS: &[&str] = &["symbolic-ref", "-q", "HEAD"];
pub const SHA_ARGS: &[&str] = &["rev-parse", "-q", "--verify", "HEAD"];

pub fn parse(symbolic: Option<&[u8]>, sha: Option<&[u8]>) -> Head {
    let sha = sha
        .map(|s| String::from_utf8_lossy(s).trim().to_string())
        .filter(|s| !s.is_empty());
    match symbolic {
        Some(r) => {
            let r = String::from_utf8_lossy(r).trim().to_string();
            let name = r.strip_prefix("refs/heads/").unwrap_or(&r).to_string();
            if sha.is_some() {
                Head::Branch { name }
            } else {
                Head::Unborn { name }
            }
        }
        None => Head::Detached { sha: sha.unwrap_or_default() },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn variants() {
        assert_eq!(
            parse(Some(b"refs/heads/main\n"), Some(b"abc\n")),
            Head::Branch { name: "main".into() }
        );
        assert_eq!(parse(None, Some(b"abc\n")), Head::Detached { sha: "abc".into() });
        assert_eq!(parse(Some(b"refs/heads/x\n"), None), Head::Unborn { name: "x".into() });
    }
}
