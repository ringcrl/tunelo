pub mod codec;
pub mod messages;
pub mod ws_mux;

pub use codec::{read_message, write_message};
pub use messages::*;
pub use ws_mux::{WsBidi, WsMux, WsStreamReader, WsStreamWriter};

/// Protocol version — increment on breaking changes.
pub const PROTOCOL_VERSION: u8 = 1;

/// Maximum control message size (64 KB).
pub const MAX_MESSAGE_SIZE: u32 = 65536;

/// Size of the relay copy buffer. 64 KB matches typical kernel socket buffers
/// and is the sweet spot for throughput vs memory on modern systems.
pub const RELAY_BUF_SIZE: usize = 64 * 1024;
