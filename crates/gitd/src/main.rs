mod auth;
mod autofetch;
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
    server::run(args).await
}
