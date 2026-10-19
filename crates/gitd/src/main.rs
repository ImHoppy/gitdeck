mod auth;
mod cli;
mod handlers;
mod protocol;
mod server;
mod static_files;

use clap::Parser;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args = cli::Args::parse();
    server::run(args).await
}
