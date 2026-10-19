use crate::RepoId;
use std::collections::HashMap;

const FAILURES_BEFORE_BACKOFF: u32 = 3;
const BACKOFF_FACTOR: u64 = 4;

#[derive(Default)]
pub struct FetchBackoff {
    failures: HashMap<RepoId, u32>,
}

impl FetchBackoff {
    pub fn due(&self, id: RepoId, tick: u64) -> bool {
        self.failures.get(&id).copied().unwrap_or(0) < FAILURES_BEFORE_BACKOFF
            || tick % BACKOFF_FACTOR == 0
    }

    pub fn record(&mut self, id: RepoId, ok: bool) {
        if ok {
            self.failures.remove(&id);
        } else {
            *self.failures.entry(id).or_default() += 1;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backs_off_after_three_failures_until_success() {
        let mut b = FetchBackoff::default();
        for _ in 0..2 {
            b.record(1, false);
        }
        assert!(b.due(1, 1));
        b.record(1, false);
        assert!(!b.due(1, 1));
        assert!(b.due(1, 4));
        b.record(1, true);
        assert!(b.due(1, 1));
    }
}
