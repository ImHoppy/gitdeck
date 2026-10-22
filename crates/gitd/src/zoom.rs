/// Chrome's zoom steps.
pub const LEVELS: [f64; 13] = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];

const EPSILON: f64 = 0.001;

/// The next level up (`by > 0`), down (`by < 0`), or back to 100% (`by == 0`).
pub fn step(current: f64, by: i32) -> f64 {
    match by.signum() {
        1 => LEVELS.iter().copied().find(|l| *l > current + EPSILON).unwrap_or(LEVELS[LEVELS.len() - 1]),
        -1 => LEVELS.iter().copied().rev().find(|l| *l < current - EPSILON).unwrap_or(LEVELS[0]),
        _ => 1.0,
    }
}

pub fn clamp(level: f64) -> f64 {
    if level.is_finite() {
        level.clamp(LEVELS[0], LEVELS[LEVELS.len() - 1])
    } else {
        1.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn steps_through_the_levels() {
        assert_eq!(step(1.0, 1), 1.1);
        assert_eq!(step(1.0, -1), 0.9);
        assert_eq!(step(1.25, 0), 1.0);
        assert_eq!(step(1.3, 1), 1.5);
        assert_eq!(step(1.3, -1), 1.25);
        assert_eq!(step(3.0, 1), 3.0);
        assert_eq!(step(0.5, -1), 0.5);
    }

    #[test]
    fn keeps_levels_in_range() {
        assert_eq!(clamp(9.0), 3.0);
        assert_eq!(clamp(0.1), 0.5);
        assert_eq!(clamp(f64::NAN), 1.0);
    }
}
