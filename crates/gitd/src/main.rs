// a GUI program: started from a shortcut it opens no console window
#![cfg_attr(windows, windows_subsystem = "windows")]

mod auth;
mod autofetch;
mod autostart;
mod avatars;
mod browser;
mod cli;
mod command_log;
mod events;
mod explorer;
mod handlers;
mod histories;
mod hub;
mod launcher;
mod lifecycle;
mod live;
mod protocol;
mod server;
mod snapshot;
mod static_files;
#[cfg(windows)]
mod tray;
#[cfg(windows)]
mod window;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    #[cfg(windows)]
    attach_console();
    let args = cli::Args::parse();
    if let Some(mode) = &args.autostart {
        autostart::set(mode == "on")?;
        println!("autostart {mode}");
        return Ok(());
    }
    if let Some(mode) = &args.explorer {
        explorer::set(mode == "on")?;
        println!("explorer menu {mode}");
        return Ok(());
    }
    server::run(args).await
}

/// Started from a terminal, print there as a console program would.
#[cfg(windows)]
fn attach_console() {
    use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // SAFETY: plain Win32 call; failing just means there is no terminal to write to
    unsafe {
        AttachConsole(ATTACH_PARENT_PROCESS);
    }
}
