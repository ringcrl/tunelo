//! Protocol messages exchanged between client and gateway.
//!
//! Design inspired by bore's ClientMessage/ServerMessage enum pattern,
//! but extended for hostname-based routing (like frp/cloudflared).
//!
//! Key design principle: control messages use structured serialization,
//! but the data plane streams raw bytes with zero parsing overhead.

use serde::{Deserialize, Serialize};

// ─── Control Stream Messages ─────────────────────────────────────────────────
//
// These are exchanged on the first QUIC bidi stream (the "control stream").
// Low frequency — one Register at startup, then periodic heartbeats.

/// Messages sent from the client to the gateway on the control stream.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ClientControl {
    /// Initial registration request.
    Register {
        /// Protocol version for compatibility checking.
        version: u8,
        /// Optional desired subdomain. If None, server assigns a random one.
        requested_subdomain: Option<String>,
        /// Optional access code for private tunnels (like a Zoom meeting password).
        /// If set, visitors must enter this code before accessing the tunnel.
        /// The gateway serves an auth page and sets a cookie after validation.
        #[serde(default)]
        access_code: Option<String>,
    },
    /// Response to a heartbeat ping from the gateway.
    HeartbeatAck,
}

/// Messages sent from the gateway to the client on the control stream.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum GatewayControl {
    /// Successful registration response.
    Registered {
        /// The full public hostname, e.g. "abc123.tunelo.net"
        hostname: String,
        /// Unique tunnel session ID.
        tunnel_id: String,
    },
    /// Registration or protocol error.
    Error { code: u16, message: String },
    /// Periodic heartbeat to verify the tunnel is alive.
    Heartbeat,
    /// Server-initiated shutdown of the tunnel.
    Shutdown { reason: String },
}

// ─── Data Streams ────────────────────────────────────────────────────────────
//
// Data streams carry raw HTTP bytes with ZERO parsing on the tunnel path.
// The gateway peeks at the Host header *before* opening the QUIC stream,
// then blindly relays all bytes. No protocol messages on data streams at all.
//
// This is the key performance insight: the tunnel is a transparent byte pipe.

// ─── Error Codes ─────────────────────────────────────────────────────────────

pub mod error_codes {
    pub const SUBDOMAIN_TAKEN: u16 = 1001;
    pub const INVALID_SUBDOMAIN: u16 = 1002;
    pub const VERSION_MISMATCH: u16 = 1003;
    pub const SERVER_FULL: u16 = 1004;
    pub const INTERNAL_ERROR: u16 = 1500;
}
