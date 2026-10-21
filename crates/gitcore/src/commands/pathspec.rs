/// Windows caps a whole command line at 32767 chars; stay well under it with the git prefix and quoting.
const MAX_CHARS: usize = 24_000;

/// Splits paths into batches that each fit on one command line.
pub fn chunks(paths: &[String]) -> Vec<&[String]> {
    let mut out = Vec::new();
    let (mut start, mut len) = (0, 0);
    for (i, p) in paths.iter().enumerate() {
        let n = p.len() + 3;
        if i > start && len + n > MAX_CHARS {
            out.push(&paths[start..i]);
            (start, len) = (i, 0);
        }
        len += n;
    }
    if start < paths.len() {
        out.push(&paths[start..]);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_long_lists() {
        assert!(chunks(&[]).is_empty());
        let p: Vec<String> = (0..5000).map(|i| format!("clothes/some/longer/path/file_{i}.png")).collect();
        let c = chunks(&p);
        assert!(c.len() > 1);
        assert_eq!(c.iter().map(|c| c.len()).sum::<usize>(), p.len());
        assert!(c.iter().all(|c| c.iter().map(|p| p.len() + 3).sum::<usize>() <= MAX_CHARS));
    }
}
