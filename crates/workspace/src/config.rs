use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct Config {
    /// The git executable; unset means `git` from PATH.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub git: Option<PathBuf>,
    /// Fetch commit authors' pictures from GitHub (the one third-party call, off by default).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub github_avatars: bool,
    /// The pull request view, through the host's own `gh` login (off by default).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub github_prs: bool,
    /// Editor for conflicts and "open in editor": a command on PATH or a full path; unset is `code`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub editor: Option<String>,
    /// File manager for "open in file explorer" (e.g. FPilot.exe); unset is the system one.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_manager: Option<String>,
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
    /// Also show git repos cloned inside this one that aren't submodules (ignored folders).
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub nested: bool,
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
    #[error("writing config: {0}")]
    Write(#[from] toml::ser::Error),
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

    pub fn set_fetch_interval(&mut self, name: &str, minutes: u64) {
        if let Some(w) = self.workspaces.iter_mut().find(|w| w.name == name) {
            w.fetch_interval_minutes = minutes;
        }
    }

    /// Turns the nested-repo scan of root `path` in workspace `name` on or off.
    pub fn set_nested(&mut self, name: &str, path: &Path, on: bool) -> bool {
        let Some(ws) = self.workspaces.iter_mut().find(|w| w.name == name) else { return false };
        let Some(root) = ws.roots.iter_mut().find(|r| same_path(&r.path, path)) else { return false };
        root.nested = on;
        true
    }

    pub fn save(&self, path: &Path) -> Result<(), ConfigError> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        std::fs::write(path, toml::to_string_pretty(self)?)?;
        Ok(())
    }

    /// Adds `path` as a root of workspace `name`, creating the workspace when it is new.
    pub fn add_root(&mut self, name: &str, path: PathBuf) {
        let ws = match self.workspaces.iter().position(|w| w.name == name) {
            Some(i) => &mut self.workspaces[i],
            None => {
                self.workspaces.push(WorkspaceConfig {
                    name: name.to_string(),
                    roots: Vec::new(),
                    exclude: Exclude::default(),
                    fetch_interval_minutes: default_fetch_minutes(),
                });
                self.workspaces.last_mut().unwrap()
            }
        };
        if !ws.roots.iter().any(|r| same_path(&r.path, &path)) {
            ws.roots.push(RootConfig { path, submodules: SubmoduleMode::default(), nested: false });
        }
    }

    pub fn remove_root(&mut self, name: &str, path: &Path) {
        if let Some(ws) = self.workspaces.iter_mut().find(|w| w.name == name) {
            ws.roots.retain(|r| !same_path(&r.path, path));
        }
    }

    pub fn set_excluded(&mut self, name: &str, path: &Path, excluded: bool) {
        if let Some(ws) = self.workspaces.iter_mut().find(|w| w.name == name) {
            ws.exclude.paths.retain(|p| !same_path(p, path));
            if excluded {
                ws.exclude.paths.push(path.to_path_buf());
            }
        }
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

    #[test]
    fn adds_roots_and_round_trips() {
        let mut cfg = Config::default();
        cfg.add_root("ava", "E:/AvaServer".into());
        cfg.add_root("ava", r"E:\AvaServer".into());
        cfg.set_excluded("ava", Path::new("E:/AvaServer/big"), true);
        let back: Config = toml::from_str(&toml::to_string_pretty(&cfg).unwrap()).unwrap();
        let ws = back.workspace("ava").unwrap();
        assert_eq!(ws.roots.len(), 1);
        assert!(ws.is_excluded(Path::new("E:/AvaServer/big")));
    }
}

