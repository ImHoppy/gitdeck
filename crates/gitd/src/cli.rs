use std::{net::SocketAddr, path::PathBuf};

#[derive(clap::Parser, Debug)]
pub struct Args {
    #[arg(long, default_value = "127.0.0.1:7777")]
    pub bind: SocketAddr,
    #[arg(long)]
    pub config: Option<PathBuf>,
    /// Seconds to wait after the last client closes before exiting.
    #[arg(long, default_value_t = 30)]
    pub grace: u64,
    /// Stay up with no client connected.
    #[arg(long)]
    pub keep: bool,
    /// Don't open a window on start.
    #[arg(long)]
    pub no_open: bool,
    /// Open the page in the browser instead of a gitdeck window (always so off Windows).
    #[arg(long)]
    pub browser: bool,
    /// Start gitd (kept running) at login, or stop doing so, then exit.
    #[arg(long, value_parser = ["on", "off"])]
    pub autostart: Option<String>,
    /// Open the repository at this path in a window (starting gitd if needed).
    #[arg(long)]
    pub open: Option<PathBuf>,
    /// Add or remove "Open in gitdeck" on folders in Windows Explorer, then exit.
    #[arg(long, value_parser = ["on", "off"])]
    pub explorer: Option<String>,
}

pub fn config_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("gitdeck")
}
