//! Tunelo Relay — public-facing server.
//!
//! 1. Accepts QUIC tunnel connections from clients
//! 2. Accepts WebSocket tunnel connections from clients (UDP-blocked fallback)
//! 3. Accepts public HTTP connections from browsers
//! 4. Routes by hostname through the tunnel

pub mod http_listener;
pub mod proxy;
pub mod router;
pub mod tls;
pub mod tunnel;
pub mod ws_tunnel;

use std::sync::Arc;
use anyhow::Result;
use tracing::info;

/// Start the relay server.
pub async fn run(
    domain: String,
    tunnel_addr: String,
    http_addr: String,
    max_session: u64,
    ws_tunnel_addr: Option<String>,
) -> Result<()> {
    info!(
        domain = %domain,
        tunnel = %tunnel_addr,
        http = %http_addr,
        ws_tunnel = ?ws_tunnel_addr,
        max_session_secs = max_session,
        "starting relay"
    );

    let router = Arc::new(router::Router::new());
    let quic_config = tls::build_quic_server_config()?;

    let r1 = router.clone();
    let t_addr = tunnel_addr.clone();
    let d = domain.clone();
    let tunnel_task = tokio::spawn(async move {
        tunnel::run_tunnel_listener(t_addr, quic_config, r1, d, max_session).await
    });

    let r2 = router.clone();
    let h_addr = http_addr.clone();
    let http_task = tokio::spawn(async move {
        http_listener::run_http_listener(h_addr, r2).await
    });

    // Optionally start WebSocket tunnel listener
    if let Some(ws_addr) = ws_tunnel_addr {
        let r3 = router.clone();
        let d3 = domain.clone();
        let ws_task = tokio::spawn(async move {
            ws_tunnel::run_ws_tunnel_listener(ws_addr, r3, d3, max_session).await
        });

        tokio::select! {
            r = tunnel_task => r??,
            r = http_task => r??,
            r = ws_task => r??,
        }
    } else {
        tokio::select! {
            r = tunnel_task => r??,
            r = http_task => r??,
        }
    }
    Ok(())
}
