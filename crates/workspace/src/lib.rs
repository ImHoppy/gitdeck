pub mod backoff;
pub mod bulk;
pub mod changes;
pub mod config;
pub mod discovery;
pub mod fetch_log;
pub mod history;
pub mod registry;
pub mod scheduler;
pub mod stage_lines;
pub mod state;
pub mod sync;
pub mod tracked;
pub mod watch;

pub use config::{Config, RootConfig, SubmoduleMode, WorkspaceConfig};
pub use registry::{RepoEntry, RepoId};
pub use scheduler::Scheduler;
pub use state::RepoState;
