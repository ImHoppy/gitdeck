//! The rows of the graph as Git Extensions builds them (`RevisionGraph.BuildOrderedRowCache`,
//! `RevisionGraphRow.BuildSegmentLanes`): every child → parent edge is a segment, each row keeps
//! the segments of the row above in order, and a commit's own segments go where its first
//! incoming segment is, so a branch keeps its lane and its colour.

pub const PALETTE_SIZE: u32 = 10;
pub const NO_LANE: i32 = -1;
const NONE: u32 = u32::MAX;

pub struct Seg {
    pub child: u32,
    pub parent: u32,
    pub info: Option<usize>,
    /// `IsSecondarySharedLaneAtLeastSinceScore`: since which row this segment shares a lane.
    secondary_since: u32,
}

pub struct LaneInfo {
    pub color: u16,
    /// The row the lane starts at: an incoming lane that started higher wins the colour.
    start: u32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Sharing {
    ExclusiveOrPrimary,
    /// Same parent, and already sharing the lane in a row above: drawn by the primary.
    Entire,
    /// Same parent: joins the lane here.
    DifferentStart,
    /// Same child: leaves the lane here.
    DifferentEnd,
}

#[derive(Debug, Clone, Copy)]
pub struct Lane {
    pub index: i32,
    pub sharing: Sharing,
}

pub struct Row {
    pub rev: u32,
    pub segs: Vec<usize>,
    pub lanes: Vec<Lane>,
    pub rev_lane: i32,
    count: i32,
    gaps: Vec<i32>,
}

pub struct Graph {
    pub segs: Vec<Seg>,
    pub infos: Vec<LaneInfo>,
    pub rows: Vec<Row>,
}

impl Row {
    pub fn lane_of(&self, seg: usize) -> Lane {
        match self.segs.iter().position(|&s| s == seg) {
            Some(i) => self.lanes[i],
            None => Lane { index: NO_LANE, sharing: Sharing::ExclusiveOrPrimary },
        }
    }

    /// The segment towards this row's first parent when `seg` ends here as the primary; else `seg`.
    pub fn first_parent_or_self(&self, seg: usize, segs: &[Seg]) -> usize {
        if segs[seg].parent != self.rev || self.lane_of(seg).sharing != Sharing::ExclusiveOrPrimary {
            return seg;
        }
        self.segs.iter().copied().find(|&s| segs[s].child == self.rev).unwrap_or(seg)
    }

    /// Shifts the lanes from `from` up to the next gap one to the right, leaving a gap at `from`.
    pub fn move_lanes_right(&mut self, from: i32, by: i32) {
        for lane in from..from + by {
            self.move_right(lane);
        }
    }

    fn move_right(&mut self, from: i32) {
        let next_gap = self.gaps.iter().copied().filter(|&g| g > from).min().unwrap_or(i32::MAX);
        if self.rev_lane >= from && self.rev_lane < next_gap {
            self.rev_lane += 1;
        }
        let moving: Vec<usize> = (0..self.lanes.len()).filter(|&i| self.lanes[i].index >= from && self.lanes[i].index < next_gap).collect();
        if moving.is_empty() {
            return;
        }
        self.gaps.push(from);
        if next_gap < i32::MAX {
            self.gaps.retain(|&g| g != next_gap);
        } else {
            self.count += 1;
        }
        for i in moving {
            self.lanes[i].index += 1;
        }
    }
}

/// `parents[i]`: row indices of commit `i`'s parents, first parent first. `seeds[i]`: a stable
/// number per commit (from its hash), so colours don't change when more history loads.
pub fn build(parents: &[Vec<u32>], seeds: &[u32]) -> Graph {
    let mut g = Graph { segs: Vec::new(), infos: Vec::new(), rows: Vec::with_capacity(parents.len()) };
    let starts: Vec<Vec<usize>> = parents
        .iter()
        .enumerate()
        .map(|(child, ps)| {
            ps.iter()
                .map(|&parent| {
                    g.segs.push(Seg { child: child as u32, parent, info: None, secondary_since: NONE });
                    g.segs.len() - 1
                })
                .collect()
        })
        .collect();

    for (r, start) in starts.iter().enumerate() {
        let r = r as u32;
        let segs = if r == 0 { first_row(&mut g, start, seeds) } else { next_row(&mut g, r, start, seeds) };
        let row = assign_lanes(&mut g.segs, r, segs);
        g.rows.push(row);
    }
    g
}

fn first_row(g: &mut Graph, start: &[usize], seeds: &[u32]) -> Vec<usize> {
    let mut left = None;
    for &s in start {
        let info = new_info(g, s, left, None, None, seeds);
        g.segs[s].info = Some(info);
        left = Some(s);
    }
    start.to_vec()
}

fn next_row(g: &mut Graph, r: u32, start: &[usize], seeds: &[u32]) -> Vec<usize> {
    let prev = g.rows[r as usize - 1].segs.clone();
    let prev_rev = r - 1;
    let mut segs = Vec::with_capacity(prev.len() + start.len());
    let mut added = false;
    for (pi, &s) in prev.iter().enumerate() {
        if g.segs[s].parent == prev_rev {
            continue;
        }
        segs.push(s);
        if g.segs[s].parent != r {
            continue;
        }
        let next = prev[pi + 1..].iter().copied().find(|&n| g.segs[n].parent != prev_rev && g.segs[n].parent != r);
        if !added {
            added = true;
            segs.extend_from_slice(start);
        }
        let mut left = s;
        for (k, &st) in start.iter().enumerate() {
            let incoming = g.segs[s].info;
            if k == 0 {
                let later = match (g.segs[st].info, incoming) {
                    (None, _) => true,
                    (Some(own), Some(inc)) => g.infos[own].start > g.infos[inc].start,
                    (Some(_), None) => false,
                };
                if later {
                    g.segs[st].info = incoming;
                }
            } else if g.segs[st].info.is_none() {
                let info = new_info(g, st, Some(left), next, incoming, seeds);
                g.segs[st].info = Some(info);
            }
            left = st;
        }
    }
    if !added {
        let mut left = segs.last().copied();
        segs.extend_from_slice(start);
        for &st in start {
            let info = new_info(g, st, left, None, None, seeds);
            g.segs[st].info = Some(info);
            left = Some(st);
        }
    }
    segs
}

/// A new lane colour, unlike its neighbours' and the lane it branches from.
fn new_info(g: &mut Graph, seg: usize, left: Option<usize>, right: Option<usize>, derived: Option<usize>, seeds: &[u32]) -> usize {
    let s = &g.segs[seg];
    let (start, mut seed) = match derived {
        Some(_) => (s.parent, seeds[s.parent as usize]),
        None => (s.child, seeds[s.child as usize] ^ seeds[s.parent as usize]),
    };
    let color_of = |x: Option<usize>| x.and_then(|x| g.segs[x].info).map(|i| g.infos[i].color);
    let avoid = [color_of(left), color_of(right), derived.map(|d| g.infos[d].color)];
    let color = loop {
        let c = (seed % PALETTE_SIZE) as u16;
        if !avoid.contains(&Some(c)) {
            break c;
        }
        seed = seed.wrapping_add(1);
    };
    g.infos.push(LaneInfo { color, start });
    g.infos.len() - 1
}

/// Segments touching the row's commit share its lane; crossing ones with the same parent share one.
fn assign_lanes(segs: &mut [Seg], r: u32, order: Vec<usize>) -> Row {
    let mut lanes: Vec<Lane> = Vec::with_capacity(order.len());
    let mut count = 0;
    let mut rev_lane = NO_LANE;
    let (mut has_start, mut has_end) = (false, false);
    let create = |count: &mut i32| {
        *count += 1;
        *count - 1
    };
    for (k, &s) in order.iter().enumerate() {
        let lane = if segs[s].child == r {
            if rev_lane < 0 {
                rev_lane = create(&mut count);
            }
            segs[s].secondary_since = NONE;
            let sharing = if has_start { Sharing::DifferentEnd } else { Sharing::ExclusiveOrPrimary };
            has_start = true;
            Lane { index: rev_lane, sharing }
        } else if segs[s].parent == r {
            if rev_lane < 0 {
                rev_lane = create(&mut count);
            }
            let sharing = if has_end {
                secondary_sharing(&mut segs[s], r)
            } else {
                has_end = true;
                segs[s].secondary_since = NONE;
                Sharing::ExclusiveOrPrimary
            };
            Lane { index: rev_lane, sharing }
        } else {
            let parent = segs[s].parent;
            let shared = (0..k).find(|&j| lanes[j].index != rev_lane && segs[order[j]].parent == parent).map(|j| lanes[j].index);
            match shared {
                Some(index) => Lane { index, sharing: secondary_sharing(&mut segs[s], r) },
                None => {
                    segs[s].secondary_since = NONE;
                    Lane { index: create(&mut count), sharing: Sharing::ExclusiveOrPrimary }
                }
            }
        };
        lanes.push(lane);
    }
    if rev_lane < 0 {
        rev_lane = create(&mut count);
    }
    Row { rev: r, segs: order, lanes, rev_lane, count, gaps: Vec::new() }
}

fn secondary_sharing(seg: &mut Seg, r: u32) -> Sharing {
    if r > seg.secondary_since {
        return Sharing::Entire;
    }
    seg.secondary_since = seg.secondary_since.min(r);
    Sharing::DifferentStart
}
