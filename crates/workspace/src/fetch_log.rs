use crate::{sync::SyncOutcome, RepoId};
use serde::Serialize;
use std::{
    collections::HashMap,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastFetch {
    pub at: u64,
    pub outcome: SyncOutcome,
}

#[derive(Default)]
pub struct FetchLog {
    last: Mutex<HashMap<RepoId, LastFetch>>,
}

impl FetchLog {
    pub fn record(&self, id: RepoId, outcome: SyncOutcome) {
        self.last.lock().unwrap().insert(id, LastFetch { at: now(), outcome });
    }

    pub fn get(&self, id: RepoId) -> Option<LastFetch> {
        self.last.lock().unwrap().get(&id).cloned()
    }

    pub fn older_than(&self, id: RepoId, secs: u64) -> bool {
        self.get(id).is_none_or(|f| now().saturating_sub(f.at) >= secs)
    }
}

pub fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}
