use super::*;

const DIFF: &str = "diff --git a/f b/f
index 1..2 100644
--- a/f
+++ b/f
@@ -1,4 +1,4 @@
 one
-two
+TWO
 three
-four
+FOUR
";

fn picked(lines: &[usize]) -> HashSet<usize> {
    lines.iter().copied().collect()
}

#[test]
fn forward_keeps_selected_change_and_turns_other_removals_into_context() {
    let out = select(DIFF, &picked(&[6, 7]), Direction::Forward).unwrap();
    assert_eq!(
        out,
        "diff --git a/f b/f\nindex 1..2 100644\n--- a/f\n+++ b/f\n@@ -1,4 +1,4 @@\n one\n-two\n+TWO\n three\n four\n"
    );
}

#[test]
fn forward_with_only_an_addition_recounts_the_hunk() {
    let out = select(DIFF, &picked(&[10]), Direction::Forward).unwrap();
    assert!(out.ends_with("@@ -1,4 +1,5 @@\n one\n two\n three\n four\n+FOUR\n"), "{out}");
}

#[test]
fn reverse_keeps_unselected_additions_as_context() {
    let out = select(DIFF, &picked(&[7]), Direction::Reverse).unwrap();
    assert!(out.ends_with("@@ -1,3 +1,4 @@\n one\n+TWO\n three\n FOUR\n"), "{out}");
}

#[test]
fn nothing_selected_is_an_error() {
    assert_eq!(select(DIFF, &picked(&[5]), Direction::Forward), Err(PatchError::NothingSelected));
    assert_eq!(select("no hunks", &picked(&[0]), Direction::Forward), Err(PatchError::NoHunks));
}

#[test]
fn later_hunks_shift_by_the_lines_earlier_hunks_added() {
    let diff = "--- a/f\n+++ b/f\n@@ -1,2 +1,3 @@\n a\n+x\n b\n@@ -10,2 +11,3 @@\n c\n+y\n d\n";
    let out = select(diff, &picked(&[4, 8]), Direction::Forward).unwrap();
    assert!(out.contains("@@ -1,2 +1,3 @@"), "{out}");
    assert!(out.contains("@@ -10,2 +11,3 @@"), "{out}");
    let only_second = select(diff, &picked(&[8]), Direction::Forward).unwrap();
    assert!(only_second.contains("@@ -10,2 +10,3 @@"), "{only_second}");
    assert!(!only_second.contains("+x"));
}

#[test]
fn no_newline_marker_follows_its_line() {
    let diff = "--- a/f\n+++ b/f\n@@ -1 +1 @@\n-old\n\\ No newline at end of file\n+new\n\\ No newline at end of file\n";
    let out = select(diff, &picked(&[3]), Direction::Forward).unwrap();
    assert!(out.ends_with("@@ -1 +0,0 @@\n-old\n\\ No newline at end of file\n"), "{out}");
}
