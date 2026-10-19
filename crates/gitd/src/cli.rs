use std::{net::SocketAddr, path::PathBuf};

#[derive(clap::Parser, Debug)]
pub struct Args {
    #[arg(long, default_value = "127.0.0.1:7777")]
    pub bind: SocketAddr,
    #[arg(long)]
    pub config: Option<PathBuf>,
}

pub fn config_dir() -> PathBuf {
    let base = std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("XDG_CONFIG_HOME"))
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".config")))
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("gitdeck")
}
