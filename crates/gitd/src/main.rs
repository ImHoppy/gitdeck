mod auth;
mod autofetch;
mod cli;
mod events;
mod handlers;
mod hub;
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
