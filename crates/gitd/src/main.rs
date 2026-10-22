// a GUI program: started from a shortcut it opens no console window
#![cfg_attr(windows, windows_subsystem = "windows")]

mod auth;
mod autofetch;
mod autostart;
mod avatars;
mod blob;
mod browser;
mod cli;
mod command_log;
#[cfg(target_os = "linux")]
mod desktop_entry;
mod events;
mod explorer;
mod file_manager;
mod github;
mod handlers;
mod histories;
mod jobs;
mod icon;
mod hub;
mod launcher;
mod lifecycle;
mod live;
#[cfg(target_os = "macos")]
mod mac_menu;
mod protocol;
mod server;
mod snapshot;
mod static_files;
#[cfg(windows)]
mod tray;
mod window;

use clap::Parser;

fn main() -> anyhow::Result<()> {
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
    let runtime = tokio::runtime::Runtime::new()?;
    #[cfg(target_os = "macos")]
    if !args.browser {
        let event_loop = window::main_thread_loop();
        std::thread::spawn(move || {
            let result = runtime.block_on(server::run(args));
            if let Err(e) = &result {
                eprintln!("Error: {e:?}");
            }
            std::process::exit(i32::from(result.is_err()));
        });
        window::run(event_loop, cli::config_dir().join("webview"));
    }
    runtime.block_on(server::run(args))
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
