mod auth;
mod autofetch;
mod autostart;
mod browser;
mod cli;
mod command_log;
mod events;
mod handlers;
mod histories;
mod hub;
mod lifecycle;
mod live;
mod protocol;
mod server;
mod snapshot;
mod static_files;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = cli::Args::parse();
    if let Some(mode) = &args.autostart {
        autostart::set(mode == "on")?;
        println!("autostart {mode}");
        return Ok(());
    }
    server::run(args).await
}
