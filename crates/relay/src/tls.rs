//! TLS configuration helpers for the relay.
//!
//! For the MVP, we generate a self-signed certificate for the QUIC tunnel listener.
//! The client will skip server cert verification in dev mode.
//! In production, the relay should use proper certificates.

use anyhow::Result;
use std::sync::Arc;

/// Build a Quinn server configuration with a self-signed certificate.
pub fn build_quic_server_config() -> Result<quinn::ServerConfig> {
    // Generate self-signed cert
    let cert = rcgen::generate_simple_self_signed(vec![
        "localhost".to_string(),
        "tunelo.net".to_string(),
        "*.tunelo.net".to_string(),
    ])?;
    let cert_der = cert.cert.der().clone();
    let key_der = cert.key_pair.serialize_der();

    let cert_chain = vec![cert_der];
    let key = rustls::pki_types::PrivatePkcs8KeyDer::from(key_der);

    let mut server_crypto = rustls::ServerConfig::builder()
        .with_no_client_auth()
        .with_single_cert(cert_chain, key.into())?;

    server_crypto.alpn_protocols = vec![b"tunelo/1".to_vec()];

    let mut server_config = quinn::ServerConfig::with_crypto(Arc::new(
        quinn::crypto::rustls::QuicServerConfig::try_from(server_crypto)?,
    ));

    // Tune transport: long idle timeout for tunnels, frequent keep-alives
    let mut transport = quinn::TransportConfig::default();
    transport.max_idle_timeout(Some(
        quinn::IdleTimeout::try_from(std::time::Duration::from_secs(300))?,
    ));
    transport.keep_alive_interval(Some(std::time::Duration::from_secs(15)));
    // Allow many concurrent streams per connection (each proxied request = 1 stream)
    transport.max_concurrent_bidi_streams(1024u32.into());
    server_config.transport_config(Arc::new(transport));

    Ok(server_config)
}
