//! Tunelo Relay — public-facing server.
//!
//! 1. Accepts QUIC tunnel connections from clients
//! 2. Accepts public HTTP connections from browsers
//! 3. Routes by hostname through the tunnel

use std::sync::Arc;

use anyhow::Result;
use clap::Parser;
use tracing::info;

mod http_listener;
mod proxy;
mod router;
mod tls;
mod tunnel;

#[derive(Parser, Debug)]
#[clap(name = "tunelo-relay", about = "Tunelo tunnel relay server")]
struct Args {
    /// Domain suffix for tunnel hostnames (e.g., "tunelo.net")
    #[clap(long, env = "TUNELO_DOMAIN", default_value = "localhost")]
    domain: String,

    /// QUIC listener for tunnel connections from clients
    #[clap(long, default_value = "0.0.0.0:4433")]
    tunnel_addr: String,

    /// HTTP listener for public browser connections
    #[clap(long, default_value = "0.0.0.0:8080")]
    http_addr: String,
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "tunelo_relay=info".into()),
        )
        .init();

    let args = Args::parse();
    info!(domain = %args.domain, tunnel = %args.tunnel_addr, http = %args.http_addr, "starting");

    let router = Arc::new(router::Router::new());
    let quic_config = tls::build_quic_server_config()?;

    let r1 = router.clone();
    let t_addr = args.tunnel_addr.clone();
    let domain = args.domain.clone();
    let tunnel_task = tokio::spawn(async move {
        tunnel::run_tunnel_listener(t_addr, quic_config, r1, domain).await
    });

    let r2 = router.clone();
    let h_addr = args.http_addr.clone();
    let http_task = tokio::spawn(async move {
        http_listener::run_http_listener(h_addr, r2).await
    });

    tokio::select! {
        r = tunnel_task => r??,
        r = http_task => r??,
    }
    Ok(())
}
