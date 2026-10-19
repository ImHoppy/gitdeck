use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Config {
    #[serde(default, rename = "workspace")]
    pub workspaces: Vec<WorkspaceConfig>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceConfig {
    pub name: String,
    #[serde(default, rename = "root")]
    pub roots: Vec<RootConfig>,
    #[serde(default)]
    pub exclude: Exclude,
    #[serde(default = "default_fetch_minutes")]
    pub fetch_interval_minutes: u64,
}

fn default_fetch_minutes() -> u64 {
    5
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootConfig {
    pub path: PathBuf,
    #[serde(default)]
    pub submodules: SubmoduleMode,
}

#[derive(Debug, Default, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SubmoduleMode {
    #[default]
    Branch,
    Pinned,
}

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Exclude {
    #[serde(default)]
    pub paths: Vec<PathBuf>,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("reading config: {0}")]
    Io(#[from] std::io::Error),
    #[error("parsing config: {0}")]
    Parse(#[from] toml::de::Error),
}

impl Config {
    pub fn load(path: &Path) -> Result<Self, ConfigError> {
        match std::fs::read_to_string(path) {
            Ok(text) => Ok(toml::from_str(&text)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }

    pub fn workspace(&self, name: &str) -> Option<&WorkspaceConfig> {
        self.workspaces.iter().find(|w| w.name == name)
    }
}

impl WorkspaceConfig {
    pub fn is_excluded(&self, path: &Path) -> bool {
        self.exclude.paths.iter().any(|p| same_path(p, path))
    }
}

pub fn same_path(a: &Path, b: &Path) -> bool {
    normalize(a) == normalize(b)
}

pub fn normalize(p: &Path) -> String {
    let s = p.to_string_lossy().replace('\\', "/");
    let s = s.trim_end_matches('/');
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_plan_example() {
        let cfg: Config = toml::from_str(
            r#"
            [[workspace]]
            name = "ava"
            [[workspace.root]]
            path = "E:/AvaServer"
            submodules = "pinned"
            [[workspace.root]]
            path = "E:/devs/athena"
            [workspace.exclude]
            paths = ["E:/AvaServer/x"]
            "#,
        )
        .unwrap();
        let ws = cfg.workspace("ava").unwrap();
        assert_eq!(ws.roots.len(), 2);
        assert_eq!(ws.roots[0].submodules, SubmoduleMode::Pinned);
        assert_eq!(ws.roots[1].submodules, SubmoduleMode::Branch);
        assert!(ws.is_excluded(Path::new("E:\\AvaServer\\x\\")));
    }
}
