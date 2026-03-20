//! Tunelo CLI
//!
//!   tunelo 3000            expose local port
//!   tunelo .               serve current directory
//!   tunelo . --local       local preview (no tunnel)
//!   tunelo ./dist -l       same, short flag

use std::path::PathBuf;

use anyhow::{bail, Result};
use clap::Parser;

mod fileserver;
mod proxy;
mod tunnel;

#[derive(Parser, Debug)]
#[clap(
    name = "tunelo",
    about = "Expose anything to the internet.",
    long_about = "Expose anything to the internet.\n\n\
                  Examples:\n  \
                  tunelo 3000              expose local HTTP service\n  \
                  tunelo .                 serve current directory\n  \
                  tunelo ./dist            serve a directory\n  \
                  tunelo . --local         local-only preview (no tunnel)\n  \
                  tunelo . -l -p 8000      local preview on port 8000\n  \
                  tunelo 3000 -s myapp     with custom subdomain\n  \
                  tunelo 3000 --private    require access code\n  \
                  tunelo 3000 --code xyz   with specific access code",
    version
)]
struct Args {
    /// Port number or file/directory path.
    target: String,

    /// Local-only mode: serve files without creating a tunnel.
    #[clap(short, long)]
    local: bool,

    /// Port for local-only mode.
    #[clap(short, long, default_value = "3000")]
    port: u16,

    /// Relay server address.
    #[clap(short, long, env = "TUNELO_RELAY", default_value = "tunelo.net:4433")]
    relay: String,

    /// Request a specific subdomain.
    #[clap(short, long)]
    subdomain: Option<String>,

    /// Local host to forward to (only for port mode).
    #[clap(short = 'H', long, default_value = "localhost")]
    local_host: String,

    /// Make tunnel private (auto-generates an access code).
    #[clap(long, conflicts_with = "code")]
    private: bool,

    /// Make tunnel private with a specific access code.
    #[clap(long, conflicts_with = "private")]
    code: Option<String>,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tunelo=info".into()),
        )
        .init();

    let args = Args::parse();

    // Resolve access code
    let access_code = if args.private {
        Some(generate_code())
    } else {
        args.code.clone()
    };

    // ── Port mode: tunnel to local service ─────────────────────
    if let Ok(port) = args.target.parse::<u16>() {
        if args.local {
            bail!("--local only works with file/directory paths, not ports");
        }
        return tunnel::run_tunnel(port, args.local_host, args.relay, args.subdomain, access_code).await;
    }

    // ── Path mode: serve files ─────────────────────────────────
    let path = PathBuf::from(&args.target);
    if !path.exists() {
        bail!(
            "'{target}' is not a valid port number or existing path.\n\n\
             Usage:\n  \
             tunelo 3000          expose local port\n  \
             tunelo ./dist        serve files\n  \
             tunelo . --local     local preview",
            target = args.target
        );
    }

    if args.local {
        // Local-only: serve files directly, no tunnel
        let display = path.canonicalize().unwrap_or(path.clone());
        let port = fileserver::start_on_port(path, args.port).await?;
        println!();
        println!("  \x1b[32m✔\x1b[0m Serving \x1b[1m{}\x1b[0m", display.display());
        println!();
        println!("  \x1b[1;36mhttp://localhost:{port}\x1b[0m");
        println!();
        println!("  Press Ctrl+C to stop.");
        println!();
        // Wait forever
        tokio::signal::ctrl_c().await?;
        println!("\n  Stopped.");
        Ok(())
    } else {
        // Tunnel mode: serve files + expose through tunnel
        let display = path.canonicalize().unwrap_or(path.clone());
        let port = fileserver::start_background(path).await?;
        println!("  \x1b[90m▸ Serving {} on :{port}\x1b[0m", display.display());
        tunnel::run_tunnel(port, "127.0.0.1".into(), args.relay, args.subdomain, access_code).await
    }
}

/// Generate a short, human-friendly access code like "fox7291".
fn generate_code() -> String {
    const WORDS: &[&str] = &[
        "sun", "moon", "star", "sky", "lake", "fox", "oak", "elm",
        "rain", "snow", "wind", "leaf", "pine", "wolf", "bear", "hawk",
        "reef", "cove", "dawn", "dusk", "peak", "vale", "glen", "bay",
        "jade", "ruby", "onyx", "iron", "silk", "reef", "tide", "wave",
    ];
    let word = WORDS[rand::random::<usize>() % WORDS.len()];
    let num = rand::random::<u16>() % 10000;
    format!("{word}{num:04}")
}
