use serde::Serialize;

pub const MAX_LANES: usize = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct Segment {
    pub from: Option<u8>,
    pub to: Option<u8>,
    pub color: u16,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Row {
    pub lane: u8,
    pub color: u16,
    pub segments: Vec<Segment>,
}

#[derive(Clone, Copy)]
struct Lane {
    target: u32,
    color: u16,
}

pub fn layout(parents: &[Vec<u32>]) -> Vec<Row> {
    let mut lanes: Vec<Option<Lane>> = Vec::new();
    let mut next_color: u16 = 0;
    let mut new_color = || {
        next_color = next_color.wrapping_add(1);
        next_color
    };
    let mut rows = Vec::with_capacity(parents.len());

    for (i, ps) in parents.iter().enumerate() {
        let i = i as u32;
        let mut segments = Vec::new();
        let incoming: Vec<usize> =
            (0..lanes.len()).filter(|&l| matches!(lanes[l], Some(x) if x.target == i)).collect();
        let (node_lane, color) = match incoming.first() {
            Some(&l) => (l, lanes[l].unwrap().color),
            None => {
                let l = free_slot(&mut lanes);
                (l, new_color())
            }
        };
        for (l, lane) in lanes.iter().enumerate() {
            let Some(lane) = lane else { continue };
            let piece = if lane.target == i {
                Segment { from: Some(l as u8), to: None, color: lane.color }
            } else {
                Segment { from: Some(l as u8), to: Some(l as u8), color: lane.color }
            };
            push(&mut segments, l, piece);
        }
        for &l in &incoming {
            lanes[l] = None;
        }

        for (n, &parent) in ps.iter().enumerate() {
            let existing = (0..lanes.len()).find(|&l| matches!(lanes[l], Some(x) if x.target == parent));
            let (l, c) = match existing {
                Some(l) => (l, lanes[l].unwrap().color),
                None => {
                    let l = if n == 0 && lanes.get(node_lane).is_some_and(Option::is_none) {
                        node_lane
                    } else {
                        free_slot(&mut lanes)
                    };
                    let c = if n == 0 { color } else { new_color() };
                    lanes[l] = Some(Lane { target: parent, color: c });
                    (l, c)
                }
            };
            push(&mut segments, l, Segment { from: None, to: Some(l as u8), color: c });
        }
        while matches!(lanes.last(), Some(None)) {
            lanes.pop();
        }
        rows.push(Row { lane: node_lane.min(MAX_LANES) as u8, color, segments });
    }
    rows
}

fn free_slot(lanes: &mut Vec<Option<Lane>>) -> usize {
    match lanes.iter().position(Option::is_none) {
        Some(l) => l,
        None => {
            lanes.push(None);
            lanes.len() - 1
        }
    }
}

fn push(segments: &mut Vec<Segment>, lane: usize, s: Segment) {
    if lane < MAX_LANES {
        segments.push(s);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lanes(rows: &[Row]) -> Vec<u8> {
        rows.iter().map(|r| r.lane).collect()
    }

    #[test]
    fn linear_history_stays_in_lane_zero() {
        let rows = layout(&[vec![1], vec![2], vec![]]);
        assert_eq!(lanes(&rows), [0, 0, 0]);
        assert_eq!(rows[1].segments, [
            Segment { from: Some(0), to: None, color: 1 },
            Segment { from: None, to: Some(0), color: 1 },
        ]);
        assert!(rows.iter().all(|r| r.color == 1));
    }

    #[test]
    fn merge_opens_a_second_lane_that_joins_back() {
        // 0 = merge(1, 2), 1 -> 3, 2 -> 3, 3 root
        let rows = layout(&[vec![1, 2], vec![3], vec![3], vec![]]);
        assert_eq!(lanes(&rows), [0, 0, 1, 0]);
        assert_eq!(rows[0].segments.len(), 2);
        assert!(rows[2].segments.contains(&Segment { from: None, to: Some(0), color: rows[0].color }));
        assert_eq!(rows[3].segments.iter().filter(|s| s.to.is_none()).count(), 1);
    }

    #[test]
    fn two_tips_get_two_lanes_and_colors() {
        // 0 -> 2, 1 -> 2, 2 root
        let rows = layout(&[vec![2], vec![2], vec![]]);
        assert_eq!(lanes(&rows), [0, 1, 0]);
        assert_ne!(rows[0].color, rows[1].color);
    }
}
