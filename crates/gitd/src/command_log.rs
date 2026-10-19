use crate::events::Event;
use gitcore::CommandRecord;
use std::{collections::VecDeque, sync::Mutex};
use tokio::sync::broadcast;

const KEEP: usize = 500;

pub struct CommandLog {
    recent: Mutex<VecDeque<CommandRecord>>,
    events: broadcast::Sender<Event>,
}

impl CommandLog {
    pub fn new(events: broadcast::Sender<Event>) -> Self {
        Self { recent: Mutex::new(VecDeque::with_capacity(KEEP)), events }
    }

    pub fn push(&self, rec: CommandRecord) {
        let mut recent = self.recent.lock().unwrap();
        if recent.len() == KEEP {
            recent.pop_front();
        }
        recent.push_back(rec.clone());
        let _ = self.events.send(Event::CommandLog(rec));
    }

    pub fn recent(&self) -> Vec<CommandRecord> {
        self.recent.lock().unwrap().iter().cloned().collect()
    }
}
