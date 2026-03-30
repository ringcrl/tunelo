//! Tunneleo — expose anything to the internet.
//!
//!   tunneleo port 3000                 expose local port
//!   tunneleo port 3000 -- pnpm dev     run command and tunnel it
//!   tunneleo serve .                   serve files with web explorer
//!   tunneleo relay                     start the relay server

use std::path::PathBuf;
use std::pin::Pin;
use std::process::Stdio;
use std::time::Duration;

use anyhow::{bail, Result};
use clap::{Parser, Subcommand};
use tokio::net::TcpStream;
use tokio::process::Command as TokioCommand;

mod fileserver;
mod proxy;
mod tunnel;

#[derive(Parser, Debug)]
#[clap(
    name = "tunneleo",
    about = "Expose anything to the internet.",
    version
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand, Debug)]
enum Command {
    /// Expose a local port through a public URL.
    ///
    /// Run a command and tunnel it:
    ///   tunneleo port 3000 -- pnpm dev
    ///   tunneleo port 5173 -- vite
    Port {
        /// Local port to expose.
        port: u16,

        /// Relay server address.
        #[clap(short, long, env = "TUNNELEO_RELAY", default_value = "agent-tunnel.woa.com:4433")]
        relay: String,

        /// Local host to forward to.
        #[clap(short = 'H', long, default_value = "localhost")]
        local_host: String,

        /// Protect the tunnel with a password.
        /// Use without a value to auto-generate one, or specify your own.
        #[clap(long, num_args = 0..=1, default_missing_value = "__auto__")]
        password: Option<String>,

        /// Transport protocol: "quic" (default) or "ws" (WebSocket fallback).
        #[clap(long, default_value = "quic")]
        transport: String,

        /// WebSocket relay address (used when --transport ws).
        /// Example: ws://relay.example.com:4434
        #[clap(long, env = "TUNNELEO_WS_RELAY")]
        ws_relay: Option<String>,

        /// Command to run (everything after --).
        #[clap(last = true)]
        command: Vec<String>,
    },

    /// Serve a file or directory with the built-in web explorer.
    Serve {
        /// File or directory to serve (defaults to current directory).
        #[clap(default_value = ".")]
        path: PathBuf,

        /// Local-only mode: serve files without creating a tunnel.
        #[clap(short, long)]
        local: bool,

        /// Port for local-only mode.
        #[clap(short, long, default_value = "3000")]
        port: u16,

        /// Relay server address.
        #[clap(short, long, env = "TUNNELEO_RELAY", default_value = "agent-tunnel.woa.com:4433")]
        relay: String,

        /// Protect the tunnel with a password.
        /// Use without a value to auto-generate one, or specify your own.
        #[clap(long, num_args = 0..=1, default_missing_value = "__auto__")]
        password: Option<String>,

        /// Transport protocol: "quic" (default) or "ws" (WebSocket fallback).
        #[clap(long, default_value = "quic")]
        transport: String,

        /// WebSocket relay address (used when --transport ws).
        #[clap(long, env = "TUNNELEO_WS_RELAY")]
        ws_relay: Option<String>,
    },

    /// Start the relay server.
    Relay {
        /// Domain suffix for tunnel hostnames (e.g., "agent-tunnel.woa.com").
        #[clap(long, env = "TUNNELEO_DOMAIN", default_value = "localhost")]
        domain: String,

        /// QUIC listener address for tunnel connections from clients.
        #[clap(long, default_value = "0.0.0.0:4433")]
        tunnel_addr: String,

        /// HTTP listener address for public browser connections.
        #[clap(long, default_value = "0.0.0.0:8080")]
        http_addr: String,

        /// Maximum tunnel session duration in seconds (0 = no limit).
        #[clap(long, default_value = "7200")]
        max_session: u64,

        /// WebSocket tunnel listener address (e.g., "0.0.0.0:4434").
        /// Enables WebSocket transport for clients behind UDP-blocking firewalls.
        #[clap(long)]
        ws_tunnel_addr: Option<String>,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tunneleo=info,tunneleo_relay=info".into()),
        )
        .init();

    let cli = Cli::parse();

    match cli.command {
        Command::Port {
            port, relay, local_host, password, transport, ws_relay, command,
        } => {
            let password = resolve_password(password);

            if !command.is_empty() {
                run_with_command(port, &local_host, relay, password, transport, ws_relay, command).await
            } else if transport == "ws" {
                let ws_addr = ws_relay.unwrap_or_else(|| relay.clone());
                tunnel::run_ws_tunnel(port, local_host, ws_addr, password).await
            } else {
                tunnel::run_tunnel(port, local_host, relay, password).await
            }
        }

        Command::Serve {
            path, local, port, relay, password, transport, ws_relay,
        } => {
            if !path.exists() {
                bail!("Path '{}' does not exist", path.display());
            }
            let password = resolve_password(password);

            if local {
                let display = path.canonicalize().unwrap_or(path.clone());
                let port = fileserver::start_on_port(path, port).await?;
                println!();
                println!("  Serving {}", display.display());
                println!();
                println!("  http://localhost:{port}");
                println!();
                println!("  Press Ctrl+C to stop.");
                println!();
                tokio::signal::ctrl_c().await?;
                println!("\n  Stopped.");
                Ok(())
            } else {
                let display = path.canonicalize().unwrap_or(path.clone());
                let port = fileserver::start_background(path).await?;
                println!("  Serving {} on :{port}", display.display());
                if transport == "ws" {
                    let ws_addr = ws_relay.unwrap_or_else(|| relay.clone());
                    tunnel::run_ws_tunnel(port, "127.0.0.1".into(), ws_addr, password).await
                } else {
                    tunnel::run_tunnel(port, "127.0.0.1".into(), relay, password).await
                }
            }
        }

        Command::Relay {
            domain, tunnel_addr, http_addr, max_session, ws_tunnel_addr,
        } => {
            tunneleo_relay::run(domain, tunnel_addr, http_addr, max_session, ws_tunnel_addr).await
        }
    }
}

/// Run a child command (e.g. `pnpm dev`), wait for the port, then start the tunnel.
async fn run_with_command(
    port: u16,
    local_host: &str,
    relay: String,
    password: Option<String>,
    transport: String,
    ws_relay: Option<String>,
    command: Vec<String>,
) -> Result<()> {
    let cmd_display = command.join(" ");
    println!("  Starting: {cmd_display}");
    println!("  PORT={port}");
    println!();

    let mut child = TokioCommand::new(&command[0])
        .args(&command[1..])
        .env("PORT", port.to_string())
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|e| anyhow::anyhow!("Failed to start '{}': {e}", command[0]))?;

    // Wait for port to accept connections
    println!("  Waiting for port {port}...");
    let host = local_host.to_string();
    let wait_result = wait_for_port(port, &host, Duration::from_secs(60)).await;

    if wait_result.is_err() {
        // Check if child already exited
        if let Ok(Some(status)) = child.try_wait() {
            bail!("Command '{cmd_display}' exited with {status} before port {port} was ready");
        }
        bail!("Timeout waiting for port {port} — command '{cmd_display}' may not be listening");
    }

    println!("  Port {port} is ready.");
    println!();

    // Run tunnel and child concurrently; exit when either stops
    let tunnel_future = if transport == "ws" {
        let ws_addr = ws_relay.unwrap_or_else(|| relay.clone());
        Box::pin(tunnel::run_ws_tunnel(port, host, ws_addr, password))
            as Pin<Box<dyn std::future::Future<Output = Result<()>>>>
    } else {
        Box::pin(tunnel::run_tunnel(port, host, relay, password))
            as Pin<Box<dyn std::future::Future<Output = Result<()>>>>
    };

    tokio::select! {
        status = child.wait() => {
            let status: std::process::ExitStatus = status?;
            println!("\n  Command exited with {status}");
            std::process::exit(status.code().unwrap_or(1));
        }
        result = tunnel_future => {
            // Tunnel ended (error or shutdown) — kill the child
            let _ = child.kill().await;
            result
        }
    }
}

/// Poll TCP connect until the port accepts a connection.
async fn wait_for_port(port: u16, host: &str, timeout: Duration) -> Result<()> {
    let deadline = tokio::time::Instant::now() + timeout;
    let addr = format!("{host}:{port}");

    loop {
        if tokio::time::Instant::now() >= deadline {
            bail!("timeout");
        }
        match TcpStream::connect(&addr).await {
            Ok(_) => return Ok(()),
            Err(_) => tokio::time::sleep(Duration::from_millis(300)).await,
        }
    }
}

fn resolve_password(password: Option<String>) -> Option<String> {
    match password {
        Some(ref v) if v == "__auto__" => Some(generate_password()),
        other => other,
    }
}

fn generate_password() -> String {
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
