mod install;
mod release;

use crate::{events::Event, server::Shared};
use anyhow::{bail, Context};
use serde::Serialize;
use std::{
    path::PathBuf,
    sync::Mutex,
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tokio::sync::broadcast;
use workspace::config::UpdateMode;

pub const USER_AGENT: &str = concat!("gitdeck/", env!("CARGO_PKG_VERSION"));
/// Set on the gitd a restart starts: an environment variable, which any version ignores or understands.
pub const REPLACE_ENV: &str = "GITD_REPLACE";
const API_TIMEOUT: Duration = Duration::from_secs(20);
const FIRST_CHECK: Duration = Duration::from_secs(30);
const CHECK_EVERY: Duration = Duration::from_secs(6 * 60 * 60);
/// How soon turning auto update on leads to a check.
const TICK: Duration = Duration::from_secs(10 * 60);
/// Long enough for the reply to reach the page before the process goes.
const EXIT_DELAY: Duration = Duration::from_millis(300);

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum UpdateState {
    Idle,
    Checking,
    /// Seconds since the epoch.
    UpToDate { at: u64 },
    /// Newer than this gitd, not downloaded: `updates = "notify"` or a manual check.
    Available { version: String },
    Downloading { version: String },
    /// On disk, used from the next start of gitd.
    Installed { version: String },
    Failed { message: String },
}

/// Replaces gitd with the latest GitHub release: only when `updates` asks for it, or from Settings.
pub struct Updater {
    state: Mutex<UpdateState>,
    running: tokio::sync::Mutex<()>,
    /// Taken at start: after an update on Windows, the running image has been renamed.
    exe: Option<PathBuf>,
    events: broadcast::Sender<Event>,
}

impl Updater {
    pub fn new(events: broadcast::Sender<Event>) -> Self {
        let exe = std::env::current_exe().ok();
        if let Some(exe) = &exe {
            install::remove_leftovers(exe);
        }
        Self { state: Mutex::new(UpdateState::Idle), running: tokio::sync::Mutex::new(()), exe, events }
    }

    pub fn state(&self) -> UpdateState {
        self.state.lock().unwrap().clone()
    }

    fn set(&self, state: UpdateState) -> UpdateState {
        *self.state.lock().unwrap() = state.clone();
        let _ = self.events.send(Event::Update(state.clone()));
        state
    }

    /// Checks GitHub and, with `install`, downloads and installs a newer release; a second call
    /// meanwhile waits for none.
    pub async fn run(&self, install: bool) -> UpdateState {
        let Ok(_running) = self.running.try_lock() else { return self.state() };
        if let UpdateState::Installed { .. } = self.state() {
            return self.state();
        }
        self.set(UpdateState::Checking);
        match self.update(install).await {
            Ok(state) => self.set(state),
            Err(e) => self.set(UpdateState::Failed { message: format!("{e:#}") }),
        }
    }

    async fn update(&self, install: bool) -> anyhow::Result<UpdateState> {
        if cfg!(debug_assertions) {
            bail!("a development build does not update itself");
        }
        let exe = self.exe.clone().context("cannot tell where gitd runs from")?;
        let asset_name = release::asset_name().context("no release binary for this platform")?;
        let current = release::parse_version(env!("CARGO_PKG_VERSION")).context("unreadable own version")?;
        let latest = tokio::task::spawn_blocking(fetch_latest).await??;
        let Some((version, asset)) = latest.newer_than(current, asset_name) else {
            return Ok(UpdateState::UpToDate { at: now() });
        };
        let version = release::display(version);
        if !install {
            return Ok(UpdateState::Available { version });
        }
        let asset = asset.cloned().with_context(|| format!("release {version} has no {asset_name}"))?;
        self.set(UpdateState::Downloading { version: version.clone() });
        tokio::task::spawn_blocking(move || install::replace_exe(&exe, env!("CARGO_PKG_VERSION"), &install::download(&asset)?)).await??;
        Ok(UpdateState::Installed { version })
    }

    /// Starts the installed version in place of this process, which then exits.
    pub fn restart(&self) -> anyhow::Result<()> {
        if !matches!(self.state(), UpdateState::Installed { .. }) {
            bail!("no update is installed");
        }
        let exe = self.exe.as_ref().context("cannot tell where gitd runs from")?;
        std::process::Command::new(exe)
            .args(restart_args(std::env::args().skip(1), crate::window::open_count() > 0))
            .env(REPLACE_ENV, "1")
            .spawn()
            .context("cannot start the new gitd")?;
        tokio::spawn(async {
            tokio::time::sleep(EXIT_DELAY).await;
            std::process::exit(0);
        });
        Ok(())
    }
}

fn fetch_latest() -> anyhow::Result<release::Release> {
    let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(API_TIMEOUT)).build().into();
    let body = agent
        .get(release::LATEST_URL)
        .header("User-Agent", USER_AGENT)
        .header("Accept", "application/vnd.github+json")
        .call()?
        .body_mut()
        .read_to_string()?;
    Ok(serde_json::from_str(&body)?)
}

fn now() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs())
}

/// The same server again. Native windows die with this process, so they get a new one; browser
/// pages reconnect and reload by themselves.
fn restart_args(args: impl Iterator<Item = String>, reopen_window: bool) -> Vec<String> {
    let mut out = Vec::new();
    let mut args = args.peekable();
    while let Some(arg) = args.next() {
        match arg.as_str() {
            "--no-open" => {}
            "--open" => {
                args.next();
            }
            a if a.starts_with("--open=") => {}
            _ => out.push(arg),
        }
    }
    if !reopen_window {
        out.push("--no-open".into());
    }
    out
}

/// Checks soon after start, then every few hours, unless `updates` is off.
pub fn spawn(app: Shared) {
    tokio::spawn(async move {
        tokio::time::sleep(FIRST_CHECK).await;
        let mut last: Option<tokio::time::Instant> = None;
        loop {
            let mode = app.config.lock().unwrap().updates;
            if mode != UpdateMode::Off && last.is_none_or(|t| t.elapsed() >= CHECK_EVERY) {
                app.updater.run(mode == UpdateMode::Auto).await;
                last = Some(tokio::time::Instant::now());
            }
            tokio::time::sleep(TICK).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restarts_with_the_same_server_settings() {
        let args = ["--keep", "--no-open", "--bind", "127.0.0.1:7800", "--open", "E:/x"].map(String::from);
        assert_eq!(restart_args(args.clone().into_iter(), true), ["--keep", "--bind", "127.0.0.1:7800"]);
        assert_eq!(restart_args(args.into_iter(), false), ["--keep", "--bind", "127.0.0.1:7800", "--no-open"]);
    }
}
