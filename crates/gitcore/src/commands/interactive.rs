//! Interactive rebase without an editor: gitd writes the todo list and git copies it in through
//! `sequence.editor`; a reword is a pick followed by an `exec` that amends the message from a file.

use serde::Deserialize;
use std::path::Path;

/// The commits after `base` on the current branch, oldest first, as `<sha>\x1f<parents>\x1f<subject>`.
pub fn plan_args(base: &str) -> Vec<String> {
    vec!["log".into(), "--reverse".into(), "--first-parent".into(), "--format=%H%x1f%P%x1f%s".into(), format!("{base}..HEAD")]
}

#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize)]
pub struct PlannedCommit {
    pub sha: String,
    pub subject: String,
    pub merge: bool,
}

pub fn parse_plan(out: &[u8]) -> Vec<PlannedCommit> {
    String::from_utf8_lossy(out)
        .lines()
        .filter_map(|l| {
            let mut f = l.splitn(3, '\x1f');
            let sha = f.next()?.to_string();
            let merge = f.next()?.split(' ').filter(|p| !p.is_empty()).count() > 1;
            Some(PlannedCommit { sha, subject: f.next().unwrap_or("").to_string(), merge })
        })
        .collect()
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Step {
    Pick,
    Reword,
    Squash,
    Fixup,
    Drop,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TodoItem {
    pub sha: String,
    pub step: Step,
    /// The new message of a reword.
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum TodoError {
    #[error("nothing to rebase")]
    Empty,
    #[error("the first kept commit can't be squashed or fixed up: there is nothing before it to join")]
    NothingToJoin,
    #[error("a reword needs a message")]
    NoMessage,
}

/// The todo file text; `message_file(i)` names where item `i`'s reword message is written.
pub fn todo(items: &[TodoItem], message_file: impl Fn(usize) -> String) -> Result<String, TodoError> {
    if items.iter().all(|i| i.step == Step::Drop) {
        return Err(TodoError::Empty);
    }
    let mut out = String::new();
    let mut kept = false;
    for (i, item) in items.iter().enumerate() {
        let line = match item.step {
            Step::Pick => format!("pick {}\n", item.sha),
            Step::Reword => {
                if item.message.as_deref().is_none_or(|m| m.trim().is_empty()) {
                    return Err(TodoError::NoMessage);
                }
                format!("pick {}\nexec git commit --amend --allow-empty --quiet --file '{}'\n", item.sha, message_file(i))
            }
            Step::Squash | Step::Fixup if !kept => return Err(TodoError::NothingToJoin),
            Step::Squash => format!("squash {}\n", item.sha),
            Step::Fixup => format!("fixup {}\n", item.sha),
            Step::Drop => format!("drop {}\n", item.sha),
        };
        kept |= item.step != Step::Drop;
        out.push_str(&line);
    }
    Ok(out)
}

/// `core.editor=true` keeps squashed messages joined as git proposes them.
pub fn run_args(base: &str, todo_file: &Path) -> Vec<String> {
    vec![
        "-c".into(),
        format!("sequence.editor=cp '{}'", sh_path(todo_file)),
        "-c".into(),
        "core.editor=true".into(),
        "rebase".into(),
        "--interactive".into(),
        "--autostash".into(),
        base.into(),
    ]
}

/// Git runs editors through sh, which wants forward slashes, also on Windows.
pub fn sh_path(p: &Path) -> String {
    p.to_string_lossy().replace('\\', "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn item(sha: &str, step: Step) -> TodoItem {
        TodoItem { sha: sha.into(), step, message: None }
    }

    #[test]
    fn plan_lines() {
        let p = parse_plan(b"aaa\x1fp1\x1ffirst\nbbb\x1fp1 p2\x1fMerge x\n");
        assert_eq!(p[0], PlannedCommit { sha: "aaa".into(), subject: "first".into(), merge: false });
        assert!(p[1].merge);
    }

    #[test]
    fn todo_lines_and_rewords() {
        let mut r = item("b", Step::Reword);
        r.message = Some("better".into());
        let text = todo(&[item("a", Step::Pick), r, item("c", Step::Fixup), item("d", Step::Drop)], |i| format!("/tmp/m{i}")).unwrap();
        assert_eq!(text, "pick a\npick b\nexec git commit --amend --allow-empty --quiet --file '/tmp/m1'\nfixup c\ndrop d\n");
    }

    #[test]
    fn refuses_what_git_would_choke_on() {
        assert_eq!(todo(&[item("a", Step::Squash)], |_| String::new()), Err(TodoError::NothingToJoin));
        assert_eq!(todo(&[item("a", Step::Drop), item("b", Step::Fixup)], |_| String::new()), Err(TodoError::NothingToJoin));
        assert_eq!(todo(&[item("a", Step::Drop)], |_| String::new()), Err(TodoError::Empty));
        assert_eq!(todo(&[item("a", Step::Reword)], |_| String::new()), Err(TodoError::NoMessage));
    }

    #[test]
    fn editor_config_uses_forward_slashes() {
        let args = run_args("abc", Path::new(r"C:\Users\x\todo"));
        assert_eq!(args[1], "sequence.editor=cp 'C:/Users/x/todo'");
        assert_eq!(args[7], "abc");
    }
}
