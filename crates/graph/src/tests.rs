use super::*;

fn seeds(n: usize) -> Vec<u32> {
    (0..n as u32).map(|i| i.wrapping_mul(2_654_435_761)).collect()
}

fn run(parents: &[Vec<u32>]) -> Vec<Row> {
    layout(parents, &seeds(parents.len()))
}

fn lanes(rows: &[Row]) -> Vec<u8> {
    rows.iter().map(|r| r.lane).collect()
}

#[test]
fn linear_history_stays_in_one_lane_and_colour() {
    let rows = run(&[vec![1], vec![2], vec![]]);
    assert_eq!(lanes(&rows), [0, 0, 0]);
    assert!(rows.iter().all(|r| r.color == rows[0].color));
    assert_eq!(rows[1].segments.len(), 2);
}

#[test]
fn main_keeps_its_lane_and_colour_when_a_branch_shares_its_parent() {
    // 0 merges feature 1 into main; main's previous commit 2 and the feature both come from 3
    let rows = run(&[vec![2, 1], vec![3], vec![3], vec![]]);
    assert_eq!(rows[0].lane, 0);
    assert_eq!(rows[2].lane, 0);
    assert_eq!(rows[3].lane, 0);
    assert_eq!(rows[2].color, rows[0].color);
    assert_eq!(rows[3].color, rows[0].color);
    assert_ne!(rows[1].color, rows[0].color);
}

#[test]
fn a_run_of_merges_keeps_main_leftmost() {
    // main: 0 → 2 → 4 → 6, each merging a one-commit branch (1, 3, 5) forked from the next main commit
    let parents = [vec![2, 1], vec![2], vec![4, 3], vec![4], vec![6, 5], vec![6], vec![]];
    let rows = run(&parents);
    for main in [0, 2, 4, 6] {
        assert_eq!(rows[main].lane, 0, "row {main}");
        assert_eq!(rows[main].color, rows[0].color, "row {main}");
    }
}

#[test]
fn two_tips_get_two_lanes_and_colours() {
    let rows = run(&[vec![2], vec![2], vec![]]);
    assert_eq!(lanes(&rows), [0, 1, 0]);
    assert_ne!(rows[0].color, rows[1].color);
}

#[test]
fn colours_follow_the_commits_not_their_rows() {
    let parents = [vec![1, 2], vec![3], vec![3], vec![]];
    let a = layout(&parents, &[7, 8, 9, 10]);
    let b = layout(&parents, &[7, 8, 9, 10]);
    assert_eq!(a, b);
}

/// Deterministic pseudo-random histories: every line drawn into a row's bottom edge continues
/// from the top edge of the row below, at the same lane, straightened or not.
#[test]
fn lines_stay_connected_on_generated_histories() {
    let mut state: u64 = 0x2545_f491_4f6c_dd1d;
    let mut rand = |n: u32| {
        state ^= state << 13;
        state ^= state >> 7;
        state ^= state << 17;
        (state % n as u64) as u32
    };
    for _ in 0..50 {
        let n = 60;
        let parents: Vec<Vec<u32>> = (0..n)
            .map(|i| {
                if i == n - 1 {
                    return vec![];
                }
                let first = i + 1 + rand(3.min(n - 1 - i));
                let mut ps = vec![first.min(n - 1)];
                if rand(4) == 0 && first + 1 < n {
                    let second = first + 1 + rand((n - first - 1).min(6));
                    ps.push(second.min(n - 1));
                }
                ps.dedup();
                ps
            })
            .collect();
        let rows = run(&parents);
        for r in 0..rows.len() - 1 {
            for s in rows[r].segments.iter().filter(|s| s.end.is_some()) {
                let continued = rows[r + 1].segments.iter().any(|t| t.start == Some(s.center) && Some(t.center) == s.end);
                assert!(continued, "row {r}: {s:?} not continued in {:?}", rows[r + 1].segments);
            }
        }
    }
}
