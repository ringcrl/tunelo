//! WebSocket tunnel listener — accepts WS connections from tunneleo clients.
//!
//! Mirrors the QUIC tunnel listener (`tunnel.rs`) but over WebSocket transport.
//! The same registration/heartbeat/data flow is used, multiplexed over `WsMux`.

use std::sync::Arc;

use anyhow::{bail, Context, Result};
use tokio::net::TcpListener;
use tokio::time::{interval, Duration, Instant};
use tracing::{info, info_span, warn, Instrument};

use tunneleo_protocol::{
    read_message, write_message, ClientControl, RelayControl, WsMux, PROTOCOL_VERSION,
};

use crate::router::{Router, TunnelSession, TunnelTransport};

/// Run the WebSocket tunnel listener.
pub async fn run_ws_tunnel_listener(
    addr: String,
    router: Arc<Router>,
    domain: String,
    max_session: u64,
) -> Result<()> {
    let listener = TcpListener::bind(&addr).await?;
    let session_display = if max_session == 0 {
        "unlimited".into()
    } else {
        format_duration(max_session)
    };
    info!(addr = %addr, max_session = %session_display, "WebSocket tunnel listener started");

    loop {
        let (stream, remote) = listener.accept().await?;
        let router = router.clone();
        let domain = domain.clone();

        tokio::spawn(
            async move {
                // Perform WebSocket handshake
                let ws_stream = match tokio_tungstenite::accept_async(stream).await {
                    Ok(ws) => ws,
                    Err(e) => {
                        warn!(error = %e, "WebSocket handshake failed");
                        return;
                    }
                };

                info!("WebSocket tunnel connected");

                let mux = Arc::new(WsMux::new(ws_stream, true));
                if let Err(e) =
                    handle_ws_connection(mux, &router, &domain, max_session).await
                {
                    warn!(error = %e, "WS tunnel ended");
                }
            }
            .instrument(info_span!("ws_tunnel", %remote)),
        );
    }
}

async fn handle_ws_connection(
    mux: Arc<WsMux>,
    router: &Router,
    domain: &str,
    max_session: u64,
) -> Result<()> {
    // Get control stream (stream_id=0)
    let (mut tx, mut rx) = mux.control_stream().await;

    // ── Handshake ──────────────────────────────────────────────────────
    let register: ClientControl =
        read_message(&mut rx).await.context("read Register")?;
    let (version, password) = match register {
        ClientControl::Register { version, password } => (version, password),
        _ => {
            send_error(&mut tx, 1000, "expected Register").await;
            bail!("unexpected first message");
        }
    };

    if version != PROTOCOL_VERSION {
        send_error(
            &mut tx,
            tunneleo_protocol::error_codes::VERSION_MISMATCH,
            &format!("version mismatch: server={PROTOCOL_VERSION}, client={version}"),
        )
        .await;
        bail!("version mismatch");
    }

    let subdomain = router.generate_subdomain();
    let hostname = format!("{subdomain}.{domain}");
    let tunnel_id = uuid::Uuid::new_v4().to_string();
    let is_private = password.is_some();

    router.register(TunnelSession {
        subdomain: subdomain.clone(),
        hostname: hostname.clone(),
        tunnel_id: tunnel_id.clone(),
        transport: TunnelTransport::Ws(mux.clone()),
        password,
    });

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
    info!(hostname = %hostname, is_private, "WS tunnel active");

    // ── Heartbeat loop with session timer ──────────────────────────────
    let mut tick = interval(Duration::from_secs(30));
    let deadline = if max_session > 0 {
        Some(Instant::now() + Duration::from_secs(max_session))
    } else {
        None
    };

    loop {
        tokio::select! {
            _ = tick.tick() => {
                if let Some(dl) = deadline {
                    if Instant::now() >= dl {
                        let dur = format_duration(max_session);
                        info!(hostname = %hostname, "WS session expired after {dur}");
                        let _ = write_message(
                            &mut tx,
                            &RelayControl::Shutdown {
                                reason: format!("Session expired ({dur}). Reconnect to start a new one."),
                            },
                        ).await;
                        break;
                    }
                }
                if write_message(&mut tx, &RelayControl::Heartbeat).await.is_err() {
                    break;
                }
            }
            msg = read_message::<ClientControl, _>(&mut rx) => {
                match msg {
                    Ok(ClientControl::HeartbeatAck) => {}
                    Ok(other) => warn!(?other, "unexpected control message"),
                    Err(_) => break,
                }
            }
        }
    }
    Ok(())
}

fn format_duration(secs: u64) -> String {
    let h = secs / 3600;
    let m = (secs % 3600) / 60;
    if h > 0 && m > 0 {
        format!("{h}h{m}m")
    } else if h > 0 {
        format!("{h}h")
    } else {
        format!("{m}m")
    }
}

async fn send_error(tx: &mut tunneleo_protocol::WsStreamWriter, code: u16, msg: &str) {
    let _ = write_message(
        tx,
        &RelayControl::Error {
            code,
            message: msg.into(),
        },
    )
    .await;
}
