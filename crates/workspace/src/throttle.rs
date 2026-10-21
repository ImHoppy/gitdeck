//! Keeps API calls per repo under GitHub's rate limit: background refreshes are spaced widely,
//! a refresh the user asked for less so.

use std::{
    collections::HashMap,
    time::{Duration, Instant},
};

pub struct Throttle {
    background: Duration,
    manual: Duration,
    last: HashMap<String, Instant>,
}

impl Throttle {
    pub fn new(background: Duration, manual: Duration) -> Self {
        Self { background, manual, last: HashMap::new() }
    }

    /// Whether `key` may be refreshed at `now`; a yes counts as the refresh.
    pub fn take(&mut self, key: &str, now: Instant, manual: bool) -> bool {
        let gap = if manual { self.manual } else { self.background };
        let ready = self.last.get(key).is_none_or(|&at| now.duration_since(at) >= gap);
        if ready {
            self.last.insert(key.to_string(), now);
        }
        ready
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn background_waits_longer_than_manual() {
        let mut t = Throttle::new(Duration::from_secs(120), Duration::from_secs(10));
        let start = Instant::now();
        assert!(t.take("a/b", start, false));
        assert!(!t.take("a/b", start + Duration::from_secs(5), true));
        assert!(t.take("a/b", start + Duration::from_secs(11), true));
        assert!(!t.take("a/b", start + Duration::from_secs(60), false));
        assert!(t.take("c/d", start + Duration::from_secs(60), false));
        assert!(t.take("a/b", start + Duration::from_secs(200), false));
    }
}
