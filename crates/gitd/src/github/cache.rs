use serde_json::Value;
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{Duration, Instant},
};

/// Answers that change rarely (reference cards, repo settings), kept in memory for a while.
#[derive(Default)]
pub struct Cache {
    entries: Mutex<HashMap<String, (Instant, Value)>>,
}

impl Cache {
    pub fn get(&self, key: &str, ttl: Duration) -> Option<Value> {
        let entries = self.entries.lock().unwrap_or_else(|e| e.into_inner());
        entries.get(key).filter(|(at, _)| at.elapsed() < ttl).map(|(_, v)| v.clone())
    }

    pub fn put(&self, key: String, value: Value) {
        self.entries.lock().unwrap_or_else(|e| e.into_inner()).insert(key, (Instant::now(), value));
    }
}
