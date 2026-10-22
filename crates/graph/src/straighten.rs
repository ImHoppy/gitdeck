//! Git Extensions' beautification (SPEC §4.5): lanes that jog left and come back are pushed right
//! so they stay straight, and lane shifts become diagonals. Rows only ever move lanes right.

use crate::rows::{Graph, Sharing, NO_LANE};
use crate::MAX_LANES;

const LANES_LOOK_AHEAD: usize = 20;
const DIAGONALS_LOOK_AHEAD: usize = LANES_LOOK_AHEAD / 2;
/// Rows with more segments are left as they are (`StraightenGraphSegmentsLimit`).
const SEGMENTS_LIMIT: usize = 80;

pub fn lanes(g: &mut Graph) {
    let n = g.rows.len();
    if n < 3 {
        return;
    }
    let last = n - 2;
    let mut back_limit = 1;
    let mut current = 1;
    while current <= last {
        back_limit = back_limit.max(current.saturating_sub(LANES_LOOK_AHEAD));
        let moved = straighten_lane(g, current, n - 1);
        current = if moved { current.saturating_sub(LANES_LOOK_AHEAD).max(back_limit) } else { current + 1 };
    }
}

fn straighten_lane(g: &mut Graph, current: usize, last_look_ahead: usize) -> bool {
    if g.rows[current].segs.len() > SEGMENTS_LIMIT {
        return false;
    }
    for k in 0..g.rows[current].segs.len().min(MAX_LANES) {
        let seg = g.rows[current].segs[k];
        let lane = g.rows[current].lanes[k];
        if lane.sharing != Sharing::ExclusiveOrPrimary {
            continue;
        }
        let current_lane = lane.index;
        let previous_lane = g.rows[current - 1].lane_of(seg).index;
        if previous_lane <= current_lane {
            continue;
        }
        let straightened = current_lane + 1;
        let mut look_ahead_lane = current_lane;
        let mut follow = g.rows[current].first_parent_or_self(seg, &g.segs);
        let mut ahead = current + 1;
        while look_ahead_lane == current_lane && ahead <= (current + LANES_LOOK_AHEAD).min(last_look_ahead) {
            look_ahead_lane = g.rows[ahead].lane_of(follow).index;
            if look_ahead_lane == straightened || (look_ahead_lane > straightened && previous_lane == straightened) {
                for row in &mut g.rows[current..ahead] {
                    row.move_lanes_right(current_lane, 1);
                }
                return true;
            }
            follow = g.rows[ahead].first_parent_or_self(follow, &g.segs);
            ahead += 1;
        }
    }
    false
}

pub fn diagonals(g: &mut Graph) {
    let n = g.rows.len();
    if n < 3 {
        return;
    }
    let last = n - 2;
    let mut back_limit = 1;
    let mut current = 1;
    while current <= last {
        back_limit = back_limit.max(current.saturating_sub(DIAGONALS_LOOK_AHEAD));
        let last_look_ahead = (current + DIAGONALS_LOOK_AHEAD).min(n - 1);
        let moved = straighten_diagonal(g, current, last_look_ahead);
        current = if moved { current.saturating_sub(DIAGONALS_LOOK_AHEAD).max(back_limit) } else { current + 1 };
    }
}

fn straighten_diagonal(g: &mut Graph, current: usize, last_look_ahead: usize) -> bool {
    if g.rows[current].segs.len() > SEGMENTS_LIMIT {
        return false;
    }
    for k in 0..g.rows[current].segs.len().min(MAX_LANES) {
        let seg = g.rows[current].segs[k];
        let lane = g.rows[current].lanes[k];
        if lane.sharing != Sharing::ExclusiveOrPrimary {
            continue;
        }
        let current_lane = lane.index;
        let previous_lane = g.rows[current - 1].lane_of(seg).index;
        let prev_is_diagonal = |g: &Graph, delta: i32| {
            current >= 2 && {
                let pp = g.rows[current - 2].lane_of(seg).index;
                pp >= 0 && pp == previous_lane + delta
            }
        };

        // a one-lane shift followed by another one-lane shift: unfold into one diagonal
        if current_lane == previous_lane - 1 && current + 2 <= last_look_ahead {
            let follow = g.rows[current].first_parent_or_self(seg, &g.segs);
            let next_lane = g.rows[current + 1].lane_of(follow).index;
            if next_lane == current_lane {
                let follow = g.rows[current + 1].first_parent_or_self(follow, &g.segs);
                let end_lane = g.rows[current + 2].lane_of(follow).index;
                if end_lane >= 0 && end_lane == next_lane - 1 && !prev_is_diagonal(g, 1) {
                    g.rows[current].move_lanes_right(current_lane, 1);
                    return true;
                }
            }
        }

        if multi_lane_crossing_into_diagonal(g, seg, current, previous_lane, current_lane, last_look_ahead, 1)
            || multi_lane_crossing_into_diagonal(g, seg, current, previous_lane, current_lane, last_look_ahead, -1)
        {
            return true;
        }

        // join a multi-lane crossing above and below this row into one
        let delta_prev = previous_lane - current_lane;
        if previous_lane >= 0 && delta_prev.abs() >= 1 && current + 1 < g.rows.len() {
            let follow = g.rows[current].first_parent_or_self(seg, &g.segs);
            let next_lane = g.rows[current + 1].lane_of(follow).index;
            let delta_next = current_lane - next_lane;
            let next_is_diagonal = || {
                current + 2 <= last_look_ahead && {
                    let follow = g.rows[current + 1].first_parent_or_self(follow, &g.segs);
                    let nn = g.rows[current + 2].lane_of(follow).index;
                    nn >= 0 && nn == next_lane - delta_next.signum()
                }
            };
            if next_lane >= 0
                && delta_next.signum() == delta_prev.signum()
                && (delta_next + delta_prev).abs() >= 3
                && !prev_is_diagonal(g, delta_prev.signum())
                && !next_is_diagonal()
            {
                let by = if delta_next < 0 { -delta_next } else { delta_prev };
                g.rows[current].move_lanes_right(current_lane, by);
                return true;
            }
        }
    }
    false
}

/// A segment crossing several lanes in one row becomes a diagonal over the following rows.
fn multi_lane_crossing_into_diagonal(g: &mut Graph, seg: usize, current: usize, previous_lane: i32, current_lane: i32, last_look_ahead: usize, delta: i32) -> bool {
    let mut moves: Vec<(usize, i32, i32)> = Vec::new();
    let mut follow = seg;
    let mut diagonal_lane = if previous_lane >= 0 { previous_lane } else { current_lane };
    for ahead in current..=last_look_ahead {
        diagonal_lane += delta;
        let end = g.rows[ahead].lane_of(follow);
        let by = diagonal_lane - end.index;
        let last_chance = end.sharing == Sharing::DifferentStart;
        if by < 0 || end.index == NO_LANE || !(end.sharing == Sharing::ExclusiveOrPrimary || last_chance) {
            return false;
        }
        if by >= 2 && moves.len() == 2 && ahead == current + 3 && moves[1].2 == 1 {
            apply(g, &moves[..1]);
            return true;
        }
        if by == 0 && !moves.is_empty() {
            apply(g, &moves);
            return true;
        }
        if last_chance {
            return false;
        }
        if by > 0 {
            moves.push((ahead, end.index, by));
        }
        follow = g.rows[ahead].first_parent_or_self(follow, &g.segs);
    }
    false
}

fn apply(g: &mut Graph, moves: &[(usize, i32, i32)]) {
    for &(row, lane, by) in moves {
        g.rows[row].move_lanes_right(lane, by);
    }
}
