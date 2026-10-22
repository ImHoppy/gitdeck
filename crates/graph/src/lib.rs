mod rows;
mod straighten;
#[cfg(test)]
mod tests;

use rows::{Graph, Sharing};
use serde::Serialize;

pub const MAX_LANES: usize = 40;

/// One row's piece of a child → parent line: its lane in the row above (`start`), here
/// (`center`) and in the row below (`end`). No `start`: it leaves this row's commit; no `end`: it
/// arrives at it (or joins a lane that carries on).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Segment {
    pub start: Option<u8>,
    pub center: u8,
    pub end: Option<u8>,
    pub color: u16,
    /// `start` is the commit of the row above: the line leaves that node directly.
    pub from_node: bool,
    /// `end` is the commit of the row below.
    pub to_node: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Row {
    pub lane: u8,
    pub color: u16,
    pub segments: Vec<Segment>,
}

/// `parents[i]`: row indices of commit `i`'s parents, first parent first. `seeds[i]`: a number
/// from commit `i`'s hash, which picks lane colours that stay put as more history loads.
pub fn layout(parents: &[Vec<u32>], seeds: &[u32]) -> Vec<Row> {
    let mut g = rows::build(parents, seeds);
    straighten::lanes(&mut g);
    straighten::diagonals(&mut g);
    (0..g.rows.len()).map(|r| output(&g, r, seeds)).collect()
}

fn output(g: &Graph, r: usize, seeds: &[u32]) -> Row {
    let row = &g.rows[r];
    let lane_in = |other: Option<usize>, seg: usize| {
        other.map(|o| g.rows[o].lane_of(seg).index).filter(|&l| l >= 0 && (l as usize) < MAX_LANES).map(|l| l as u8)
    };
    let above = r.checked_sub(1);
    let below = (r + 1 < g.rows.len()).then_some(r + 1);
    let mut node_color = None;
    let mut segments = Vec::new();
    for (k, &seg) in row.segs.iter().enumerate() {
        let lane = row.lanes[k];
        if lane.sharing == Sharing::Entire || lane.index < 0 || lane.index as usize >= MAX_LANES {
            continue;
        }
        let s = &g.segs[seg];
        let color = s.info.map_or(0, |i| g.infos[i].color);
        let at_node = s.parent == row.rev || s.child == row.rev;
        if at_node && node_color.is_none() {
            node_color = Some(color);
        }
        let start = if s.child == row.rev { None } else { lane_in(above, seg) };
        let mut end = if s.parent == row.rev { None } else { lane_in(below, seg) };
        if lane.sharing == Sharing::DifferentStart {
            end = None;
        }
        if start.is_none() && end.is_none() {
            continue;
        }
        segments.push(Segment {
            start,
            center: lane.index as u8,
            end,
            color,
            from_node: start.is_some() && above.is_some_and(|a| s.child as usize == a),
            to_node: end.is_some() && below.is_some_and(|b| s.parent as usize == b),
        });
    }
    let lane = row.rev_lane.clamp(0, MAX_LANES as i32 - 1) as u8;
    Row { lane, color: node_color.unwrap_or((seeds[r] % rows::PALETTE_SIZE) as u16), segments }
}
