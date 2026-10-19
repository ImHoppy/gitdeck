pub mod config;
pub mod discovery;
pub mod registry;
pub mod state;
pub mod watch;

pub use config::{Config, RootConfig, SubmoduleMode, WorkspaceConfig};
pub use registry::{RepoEntry, RepoId};
pub use state::RepoState;
