//! QUIC tunnel listener — accepts connections from tunelo clients.
//!
//! Flow (bore's simplicity + reverst's QUIC registration):
//! 1. Accept QUIC connection
//! 2. Accept control stream → Register → Registered
//! 3. Heartbeat loop until disconnect
//! 4. Cleanup routing table on exit

use std::sync::Arc;

use anyhow::{bail, Context, Result};
use tokio::time::{interval, Duration};
use tracing::{info, info_span, warn, Instrument};

use tunelo_protocol::{
    read_message, write_message, ClientControl, RelayControl, PROTOCOL_VERSION,
};

use crate::router::{Router, TunnelSession};

/// Run the QUIC tunnel listener.
pub async fn run_tunnel_listener(
    addr: String,
    server_config: quinn::ServerConfig,
    router: Arc<Router>,
    domain: String,
) -> Result<()> {
    let endpoint = quinn::Endpoint::server(server_config, addr.parse()?)?;
    info!(addr = %addr, "QUIC tunnel listener started");

    while let Some(incoming) = endpoint.accept().await {
        let router = router.clone();
        let domain = domain.clone();
        tokio::spawn(async move {
            let remote = incoming.remote_address();
            async {
                match incoming.await {
                    Ok(conn) => {
                        info!("connected");
                        if let Err(e) =
                            handle_connection(conn, &router, &domain).await
                        {
                            warn!(error = %e, "tunnel ended");
                        }
                    }
                    Err(e) => warn!(error = %e, "accept failed"),
                }
            }
            .instrument(info_span!("tunnel", %remote))
            .await;
        });
    }
    Ok(())
}

/// Handle one tunnel connection: handshake → heartbeat loop → cleanup.
async fn handle_connection(
    conn: quinn::Connection,
    router: &Router,
    domain: &str,
) -> Result<()> {
    // Accept the control stream (first bidi stream opened by client)
    let (mut tx, mut rx) = conn.accept_bi().await.context("accept control stream")?;

    // ── Handshake ──────────────────────────────────────────────────────
    let register: ClientControl = read_message(&mut rx).await.context("read Register")?;
    let (version, requested, access_code) = match register {
        ClientControl::Register {
            version,
            requested_subdomain,
            access_code,
        } => (version, requested_subdomain, access_code),
        _ => {
            send_error(&mut tx, 1000, "expected Register").await;
            bail!("unexpected first message");
        }
    };

    if version != PROTOCOL_VERSION {
        send_error(
            &mut tx,
            tunelo_protocol::error_codes::VERSION_MISMATCH,
            &format!("version mismatch: server={PROTOCOL_VERSION}, client={version}"),
        )
        .await;
        bail!("version mismatch");
    }

    let subdomain = match requested {
        Some(ref req) if !is_valid_subdomain(req) => {
            send_error(&mut tx, tunelo_protocol::error_codes::INVALID_SUBDOMAIN, req).await;
            bail!("invalid subdomain: {req}");
        }
        Some(ref req) if router.contains(req) => {
            send_error(&mut tx, tunelo_protocol::error_codes::SUBDOMAIN_TAKEN, req).await;
            bail!("subdomain taken: {req}");
        }
        Some(req) => req,
        None => router.generate_subdomain(),
    };

    let hostname = format!("{subdomain}.{domain}");
    let tunnel_id = uuid::Uuid::new_v4().to_string();
    let is_private = access_code.is_some();

    router.register(TunnelSession {
        subdomain: subdomain.clone(),
        hostname: hostname.clone(),
        tunnel_id: tunnel_id.clone(),
        connection: conn.clone(),
        access_code,
    });

    // Ensure cleanup on any exit path
    let _guard = scopeguard::guard((), |_| {
        router.remove(&subdomain);
    });

    write_message(
        &mut tx,
        &RelayControl::Registered {
            hostname: hostname.clone(),
            tunnel_id,
        },
    )
    .await?;
    info!(hostname = %hostname, is_private, "tunnel active");

    // ── Heartbeat loop ─────────────────────────────────────────────────
    let mut tick = interval(Duration::from_secs(30));
    loop {
        tokio::select! {
            _ = tick.tick() => {
                if write_message(&mut tx, &RelayControl::Heartbeat).await.is_err() {
                    break;
                }
            }
            msg = read_message::<ClientControl, _>(&mut rx) => {
                match msg {
                    Ok(ClientControl::HeartbeatAck) => {}
                    Ok(other) => warn!(?other, "unexpected control message"),
                    Err(_) => break, // stream closed
                }
            }
            reason = conn.closed() => {
                info!(%reason, "QUIC connection closed");
                break;
            }
        }
    }
    Ok(())
}

async fn send_error(tx: &mut quinn::SendStream, code: u16, msg: &str) {
    let _ = write_message(
        tx,
        &RelayControl::Error {
            code,
            message: msg.into(),
        },
    )
    .await;
}

/// Validate a subdomain: 1-63 chars, [a-z0-9-], no leading/trailing hyphen.
#[inline]
fn is_valid_subdomain(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 63
        && s.bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        && s.as_bytes()[0].is_ascii_alphanumeric()
        && s.as_bytes()[s.len() - 1].is_ascii_alphanumeric()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_subdomains() {
        assert!(is_valid_subdomain("abc123"));
        assert!(is_valid_subdomain("my-app"));
        assert!(is_valid_subdomain("a"));
        assert!(!is_valid_subdomain(""));
        assert!(!is_valid_subdomain("-abc"));
        assert!(!is_valid_subdomain("abc-"));
        assert!(!is_valid_subdomain("abc.def"));
    }
}
