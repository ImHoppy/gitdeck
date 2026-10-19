use crate::model::Tracking;

pub fn args(branch: &str) -> Vec<String> {
    vec![
        "for-each-ref".into(),
        "--format=%(push:track,nobracket)::%(upstream:track,nobracket)::%(upstream)".into(),
        format!("refs/heads/{branch}"),
    ]
}

pub fn parse(out: &[u8]) -> Tracking {
    let line = String::from_utf8_lossy(out);
    let line = line.lines().next().unwrap_or("");
    let mut parts = line.split("::");
    let push = parts.next().unwrap_or("").trim();
    let up = parts.next().unwrap_or("").trim();
    let has_upstream = !parts.next().unwrap_or("").trim().is_empty();
    let chosen = if push.is_empty() { up } else { push };
    let mut t = parse_track(chosen);
    if has_upstream && chosen.is_empty() {
        t.ahead = Some(0);
        t.behind = Some(0);
    }
    t
}

fn parse_track(s: &str) -> Tracking {
    let mut t = Tracking::default();
    if s == "gone" {
        t.gone = true;
        return t;
    }
    let mut known = false;
    for part in s.split(", ") {
        if let Some(n) = part.strip_prefix("ahead ") {
            t.ahead = n.parse().ok();
            known = true;
        } else if let Some(n) = part.strip_prefix("behind ") {
            t.behind = n.parse().ok();
            known = true;
        }
    }
    if known {
        t.ahead.get_or_insert(0);
        t.behind.get_or_insert(0);
    }
    t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefers_push() {
        let t = parse(b"ahead 1::ahead 2, behind 3::refs/remotes/o/m\n");
        assert_eq!((t.ahead, t.behind), (Some(1), Some(0)));
    }

    #[test]
    fn upstream_gone_and_unknown() {
        let t = parse(b"::ahead 2, behind 3::refs/remotes/o/m\n");
        assert_eq!((t.ahead, t.behind), (Some(2), Some(3)));
        assert!(parse(b"::gone::refs/remotes/o/m\n").gone);
        assert_eq!(parse(b"::::\n"), Tracking::default());
        let t = parse(b"::::refs/remotes/o/m\n");
        assert_eq!((t.ahead, t.behind), (Some(0), Some(0)));
    }
}
