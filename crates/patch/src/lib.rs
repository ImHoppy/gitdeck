use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Direction {
    /// unselected `-` lines become context, unselected `+` are dropped
    Forward,
    /// applied with `--reverse`: unselected `+` lines become context, unselected `-` are dropped
    Reverse,
}

#[derive(Debug, PartialEq, Eq)]
pub enum PatchError {
    NoHunks,
    NothingSelected,
}

struct Hunk<'a> {
    old_start: u32,
    lines: Vec<(usize, &'a str)>,
}

pub fn select(diff: &str, selected: &HashSet<usize>, direction: Direction) -> Result<String, PatchError> {
    // not `lines()`: it would also strip the CR of CRLF files
    let mut lines: Vec<&str> = diff.split('\n').collect();
    if lines.last() == Some(&"") {
        lines.pop();
    }
    let first_hunk = lines.iter().position(|l| l.starts_with("@@")).ok_or(PatchError::NoHunks)?;
    let header = &lines[..first_hunk];
    let hunks = split_hunks(&lines, first_hunk);

    let mut out: Vec<String> = header.iter().map(|l| l.to_string()).collect();
    let mut offset: i64 = 0;
    let mut any = false;
    for hunk in &hunks {
        let mut body: Vec<String> = Vec::new();
        let (mut old_count, mut new_count, mut changed) = (0u32, 0u32, false);
        let mut last_kept = false;
        for &(i, line) in &hunk.lines {
            let picked = selected.contains(&i);
            let kept = match (line.as_bytes().first(), picked, direction) {
                (Some(b'\\'), ..) => {
                    if last_kept {
                        body.push(line.to_string());
                    }
                    continue;
                }
                (Some(b'+'), true, _) | (Some(b'-'), true, _) => {
                    changed = true;
                    Some(line.to_string())
                }
                (Some(b'+'), false, Direction::Forward) | (Some(b'-'), false, Direction::Reverse) => None,
                (Some(b'+' | b'-'), false, _) => Some(format!(" {}", &line[1..])),
                _ => Some(line.to_string()),
            };
            last_kept = kept.is_some();
            if let Some(text) = kept {
                match text.as_bytes().first() {
                    Some(b'+') => new_count += 1,
                    Some(b'-') => old_count += 1,
                    _ => {
                        old_count += 1;
                        new_count += 1;
                    }
                }
                body.push(text);
            }
        }
        if !changed {
            continue;
        }
        move_last_line_to_end(&mut body);
        any = true;
        let new_start = if new_count == 0 {
            (hunk.old_start as i64 + offset - 1).max(0)
        } else if old_count == 0 {
            hunk.old_start as i64 + offset + 1
        } else {
            hunk.old_start as i64 + offset
        };
        out.push(format!("@@ -{} +{} @@", range(hunk.old_start, old_count), range(new_start.max(0) as u32, new_count)));
        out.extend(body);
        offset += new_count as i64 - old_count as i64;
    }
    if !any {
        return Err(PatchError::NothingSelected);
    }
    let mut text = out.join("\n");
    text.push('\n');
    Ok(text)
}

/// A context line without final newline must end the hunk, or kept `+` lines get glued onto it.
fn move_last_line_to_end(body: &mut Vec<String>) {
    let Some(pos) = body.windows(2).position(|w| w[0].starts_with(' ') && w[1].starts_with('\\')) else { return };
    if body[pos + 2..].iter().any(|l| l.starts_with('+')) {
        let tail: Vec<String> = body.drain(pos..pos + 2).collect();
        body.extend(tail);
    }
}

fn range(start: u32, count: u32) -> String {
    if count == 1 { start.to_string() } else { format!("{start},{count}") }
}

fn split_hunks<'a>(lines: &[&'a str], from: usize) -> Vec<Hunk<'a>> {
    let mut hunks: Vec<Hunk<'a>> = Vec::new();
    for (i, &line) in lines.iter().enumerate().skip(from) {
        if line.starts_with("@@") {
            hunks.push(Hunk { old_start: old_start(line), lines: Vec::new() });
        } else if let Some(h) = hunks.last_mut() {
            h.lines.push((i, line));
        }
    }
    hunks
}

fn old_start(header: &str) -> u32 {
    header
        .trim_start_matches("@@ -")
        .split([',', ' '])
        .next()
        .and_then(|n| n.parse().ok())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests;
