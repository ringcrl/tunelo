//! Tunnel connection management — QUIC and WebSocket connections to the relay.
//!
//! Auto-reconnects with exponential backoff on disconnect.

use std::sync::Arc;
use std::time::Duration;

use anyhow::{bail, Context, Result};
use tokio::time::sleep;
use tracing::{error, info, info_span, warn, Instrument};

use tunneleo_protocol::{
    read_message, write_message, ClientControl, RelayControl, WsMux, PROTOCOL_VERSION,
};

use crate::proxy;

const MAX_BACKOFF: Duration = Duration::from_secs(30);
const INITIAL_BACKOFF: Duration = Duration::from_secs(1);

// ─── QUIC tunnel (existing) ────────────────────────────────────────────────

/// Establish QUIC tunnel and serve requests. Auto-reconnects on disconnect.
pub async fn run_tunnel(
    port: u16,
    local_host: String,
    relay: String,
    password: Option<String>,
) -> Result<()> {
    let local_addr: Arc<str> = format!("{local_host}:{port}").into();
    let mut backoff = INITIAL_BACKOFF;
    let mut first = true;

    loop {
        match run_once_quic(&relay, &password, &local_addr, first).await {
            Ok(SessionEnd::Shutdown(reason)) => {
                println!("\n  {reason}");
                println!("  Tunnel closed.");
                return Ok(());
            }
            Ok(SessionEnd::Disconnected) => {
                println!("\n  Disconnected. Reconnecting in {}s...", backoff.as_secs());
                sleep(backoff).await;
                backoff = (backoff * 2).min(MAX_BACKOFF);
                first = false;
            }
            Err(e) => {
                if first {
                    return Err(e);
                }
                warn!(error = %e, "connection failed, retrying in {}s", backoff.as_secs());
                println!("  Connection failed. Retrying in {}s...", backoff.as_secs());
                sleep(backoff).await;
                backoff = (backoff * 2).min(MAX_BACKOFF);
            }
        }
    }
}

// ─── WebSocket tunnel ──────────────────────────────────────────────────────

/// Establish WebSocket tunnel and serve requests. Auto-reconnects on disconnect.
pub async fn run_ws_tunnel(
    port: u16,
    local_host: String,
    ws_relay: String,
    password: Option<String>,
) -> Result<()> {
    let local_addr: Arc<str> = format!("{local_host}:{port}").into();
    let mut backoff = INITIAL_BACKOFF;
    let mut first = true;

    loop {
        match run_once_ws(&ws_relay, &password, &local_addr, first).await {
            Ok(SessionEnd::Shutdown(reason)) => {
                println!("\n  {reason}");
                println!("  Tunnel closed.");
                return Ok(());
            }
            Ok(SessionEnd::Disconnected) => {
                println!("\n  Disconnected. Reconnecting in {}s...", backoff.as_secs());
                sleep(backoff).await;
                backoff = (backoff * 2).min(MAX_BACKOFF);
                first = false;
            }
            Err(e) => {
                if first {
                    return Err(e);
                }
                warn!(error = %e, "WS connection failed, retrying in {}s", backoff.as_secs());
                println!("  Connection failed. Retrying in {}s...", backoff.as_secs());
                sleep(backoff).await;
                backoff = (backoff * 2).min(MAX_BACKOFF);
            }
        }
    }
}

enum SessionEnd {
    Shutdown(String),
    Disconnected,
}

// ─── QUIC session ──────────────────────────────────────────────────────────

async fn run_once_quic(
    relay: &str,
    password: &Option<String>,
    local_addr: &Arc<str>,
    first: bool,
) -> Result<SessionEnd> {
    let conn = connect_quic(relay).await?;
    info!(relay = %relay, "QUIC connected");

    // ── Handshake ──────────────────────────────────────────────────────
    let (mut tx, mut rx) = conn.open_bi().await?;
    write_message(
        &mut tx,
        &ClientControl::Register {
            version: PROTOCOL_VERSION,
            password: password.clone(),
        },
    )
    .await?;

    let resp: RelayControl = read_message(&mut rx).await?;
    let hostname = match resp {
        RelayControl::Registered { hostname, .. } => hostname,
        RelayControl::Error { code, message } => {
            bail!("relay error ({code}): {message}");
        }
        _ => bail!("unexpected response"),
    };

    print_url(first, &hostname, password, local_addr, "QUIC");

    // ── Data loop ──────────────────────────────────────────────────────
    let conn2 = conn.clone();
    let addr2 = local_addr.clone();
    let data_handle = tokio::spawn(async move {
        loop {
            let (send, recv) = match conn2.accept_bi().await {
                Ok(s) => s,
                Err(e) => {
                    info!(error = %e, "data accept ended");
                    return;
                }
            };
            let addr = addr2.clone();
            tokio::spawn(
                async move {
                    if let Err(e) = proxy::handle_data_stream(send, recv, &addr).await {
                        warn!(error = %e, "stream error");
                    }
                }
                .instrument(info_span!("req")),
            );
        }
    });

    // ── Control loop ─────────────────────────────────────────────────
    let result = control_loop(&mut tx, &mut rx).await;
    data_handle.abort();
    Ok(result)
}

// ─── WebSocket session ─────────────────────────────────────────────────────

async fn run_once_ws(
    ws_relay: &str,
    password: &Option<String>,
    local_addr: &Arc<str>,
    first: bool,
) -> Result<SessionEnd> {
    let mux = connect_ws(ws_relay).await?;
    let mux = Arc::new(mux);
    info!(relay = %ws_relay, "WebSocket connected");

    // ── Handshake via control stream (stream_id=0) ──────────────────
    let (mut tx, mut rx) = mux.control_stream().await;
    write_message(
        &mut tx,
        &ClientControl::Register {
            version: PROTOCOL_VERSION,
            password: password.clone(),
        },
    )
    .await?;

    let resp: RelayControl = read_message(&mut rx).await?;
    let hostname = match resp {
        RelayControl::Registered { hostname, .. } => hostname,
        RelayControl::Error { code, message } => {
            bail!("relay error ({code}): {message}");
        }
        _ => bail!("unexpected response"),
    };

    print_url(first, &hostname, password, local_addr, "WebSocket");

    // ── Data loop — accept streams from the mux ─────────────────────
    let mux2 = mux.clone();
    let addr2 = local_addr.clone();
    let data_handle = tokio::spawn(async move {
        loop {
            let (writer, reader) = match mux2.accept_bi().await {
                Ok(s) => s,
                Err(e) => {
                    info!(error = %e, "WS data accept ended");
                    return;
                }
            };
            let addr = addr2.clone();
            tokio::spawn(
                async move {
                    if let Err(e) = proxy::handle_ws_data_stream(writer, reader, &addr).await {
                        warn!(error = %e, "WS stream error");
                    }
                }
                .instrument(info_span!("ws_req")),
            );
        }
    });

    // ── Control loop ─────────────────────────────────────────────────
    let result = control_loop(&mut tx, &mut rx).await;
    data_handle.abort();
    Ok(result)
}

// ─── Shared helpers ────────────────────────────────────────────────────────

fn print_url(first: bool, hostname: &str, password: &Option<String>, local_addr: &str, transport: &str) {
    if first {
        println!();
        println!("  Tunnel is ready. (transport: {transport})");
    } else {
        println!("  Reconnected. (transport: {transport})");
    }
    println!();
    if let Some(ref pw) = password {
        println!("  Share URL:   https://{hostname}?pwd={pw}");
        println!("  Private — visitors without the link will be asked for the password.");
    } else {
        println!("  Public URL:  https://{hostname}");
    }
    println!("  Forwarding:  http://{local_addr}");
    println!();
}

/// Shared control loop for both QUIC and WS transports.
async fn control_loop<R, W>(tx: &mut W, rx: &mut R) -> SessionEnd
where
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
    let heartbeat_timeout = Duration::from_secs(90);
    loop {
        match tokio::time::timeout(heartbeat_timeout, read_message::<RelayControl, _>(rx)).await {
            Ok(Ok(RelayControl::Heartbeat)) => {
                let _ = write_message(tx, &ClientControl::HeartbeatAck).await;
            }
            Ok(Ok(RelayControl::Shutdown { reason })) => {
                break SessionEnd::Shutdown(reason);
            }
            Ok(Ok(RelayControl::Error { code, message })) => {
                error!(code, %message, "relay error");
                break SessionEnd::Disconnected;
            }
            Ok(Ok(_)) => {}
            Ok(Err(_)) => {
                info!("control stream closed");
                break SessionEnd::Disconnected;
            }
            Err(_) => {
                warn!("heartbeat timeout — relay not responding");
                break SessionEnd::Disconnected;
            }
        }
    }
}

/// Connect to the relay via QUIC.
async fn connect_quic(relay: &str) -> Result<quinn::Connection> {
    let mut crypto = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(InsecureVerifier))
        .with_no_client_auth();
    crypto.alpn_protocols = vec![b"tunneleo/1".to_vec()];

    let mut client_config = quinn::ClientConfig::new(Arc::new(
        quinn::crypto::rustls::QuicClientConfig::try_from(crypto)?,
    ));

    let mut transport = quinn::TransportConfig::default();
    transport.max_idle_timeout(Some(quinn::IdleTimeout::try_from(
        std::time::Duration::from_secs(300),
    )?));
    transport.keep_alive_interval(Some(std::time::Duration::from_secs(15)));
    transport.max_concurrent_bidi_streams(4096u32.into());
    client_config.transport_config(Arc::new(transport));

    let mut endpoint = quinn::Endpoint::client("0.0.0.0:0".parse()?)?;
    endpoint.set_default_client_config(client_config);

    let addr: std::net::SocketAddr = relay
        .parse()
        .or_else(|_| {
            use std::net::ToSocketAddrs;
            relay
                .to_socket_addrs()?
                .next()
                .ok_or_else(|| std::io::Error::other("no addresses"))
        })
        .context("resolve relay")?;

    endpoint
        .connect(addr, "tunneleo")?
        .await
        .context("QUIC connect")
}

/// Connect to the relay via WebSocket.
async fn connect_ws(relay: &str) -> Result<WsMux> {
    // Normalize URL: add ws:// if not present
    let url = if relay.starts_with("ws://") || relay.starts_with("wss://") {
        relay.to_string()
    } else {
        format!("ws://{relay}")
    };

    let (ws_stream, _response) = tokio_tungstenite::connect_async(&url)
        .await
        .context("WebSocket connect")?;

    Ok(WsMux::new(ws_stream, false))
}

#[derive(Debug)]
struct InsecureVerifier;

impl rustls::client::danger::ServerCertVerifier for InsecureVerifier {
    fn verify_server_cert(
        &self, _: &rustls::pki_types::CertificateDer<'_>,
        _: &[rustls::pki_types::CertificateDer<'_>],
        _: &rustls::pki_types::ServerName<'_>, _: &[u8],
        _: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(
        &self, _: &[u8], _: &rustls::pki_types::CertificateDer<'_>,
        _: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    fn verify_tls13_signature(
        &self, _: &[u8], _: &rustls::pki_types::CertificateDer<'_>,
        _: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }
    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}
