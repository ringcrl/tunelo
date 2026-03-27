//! WebSocket stream multiplexer.
//!
//! Provides QUIC-like `open_bi()` / `accept_bi()` over a single WebSocket connection.
//!
//! ## Frame format
//!
//! Every WebSocket binary message carries:
//!
//! ```text
//! [1 byte: frame_type][4 bytes: stream_id (big-endian u32)][payload...]
//! ```
//!
//! Frame types:
//! - `0x00` DATA    — payload bytes for the given stream
//! - `0x01` OPEN    — request to open a new stream (no payload)
//! - `0x02` CLOSE   — signal that the stream is done (no payload)
//!
//! `stream_id = 0` is reserved for the **control stream** (existing msgpack messages).

use std::collections::HashMap;
use std::io;
use std::pin::Pin;
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::Arc;
use std::task::{Context, Poll};

use anyhow::{bail, Context as _, Result};
use futures_util::{SinkExt, StreamExt};
use tokio::io::{AsyncRead, AsyncWrite, ReadBuf};
use tokio::sync::{mpsc, Mutex};
use tokio_tungstenite::tungstenite::Message;
use tracing::{debug, warn};

// ─── Frame constants ────────────────────────────────────────────────────────

const FRAME_DATA: u8 = 0x00;
const FRAME_OPEN: u8 = 0x01;
const FRAME_CLOSE: u8 = 0x02;
const HEADER_SIZE: usize = 5; // 1 byte type + 4 bytes stream_id

fn encode_frame(frame_type: u8, stream_id: u32, payload: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(HEADER_SIZE + payload.len());
    buf.push(frame_type);
    buf.extend_from_slice(&stream_id.to_be_bytes());
    buf.extend_from_slice(payload);
    buf
}

fn decode_frame(data: &[u8]) -> Result<(u8, u32, &[u8])> {
    if data.len() < HEADER_SIZE {
        bail!("ws_mux frame too short: {} bytes", data.len());
    }
    let frame_type = data[0];
    let stream_id = u32::from_be_bytes([data[1], data[2], data[3], data[4]]);
    Ok((frame_type, stream_id, &data[HEADER_SIZE..]))
}

// ─── WsMux ──────────────────────────────────────────────────────────────────

/// WebSocket stream multiplexer.
///
/// Wraps a WebSocket connection and provides QUIC-like multi-stream API.
/// All stream reads/writes go through channels, keeping the generic WebSocket
/// type confined to the internal dispatcher task.
pub struct WsMux {
    /// Channel to send outgoing frames to the write task.
    outgoing_tx: mpsc::Sender<Vec<u8>>,
    /// Channel to receive newly opened streams from the remote side.
    accept_rx: Mutex<mpsc::Receiver<(WsStreamWriter, WsStreamReader)>>,
    /// Next stream ID for locally-opened streams.
    /// Client uses odd IDs (1, 3, 5, ...), server uses even IDs (2, 4, 6, ...).
    next_stream_id: AtomicU32,
    /// Per-stream data senders (dispatcher writes into these).
    streams: Arc<Mutex<HashMap<u32, mpsc::Sender<Vec<u8>>>>>,
    /// Handle to the read dispatcher task.
    _read_task: tokio::task::JoinHandle<()>,
    /// Handle to the write task.
    _write_task: tokio::task::JoinHandle<()>,
}

impl WsMux {
    /// Create a new multiplexer from any WebSocket stream.
    ///
    /// - `ws` — the WebSocket stream (already connected / accepted).
    /// - `is_server` — if true, use even stream IDs; if false, use odd.
    pub fn new<S>(ws: S, is_server: bool) -> Self
    where
        S: futures_util::Stream<
                Item = std::result::Result<Message, tokio_tungstenite::tungstenite::Error>,
            > + futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error>
            + Unpin
            + Send
            + 'static,
    {
        let (ws_write, ws_read) = ws.split();

        let streams: Arc<Mutex<HashMap<u32, mpsc::Sender<Vec<u8>>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        // Channel for accepted streams (remote-initiated)
        let (accept_tx, accept_rx) = mpsc::channel(64);

        // Channel for outgoing frames (all writers send here, single write task flushes to WS)
        let (outgoing_tx, outgoing_rx) = mpsc::channel::<Vec<u8>>(1024);

        // Spawn write task
        let write_task = tokio::spawn(write_loop(ws_write, outgoing_rx));

        // Spawn read dispatcher
        let streams2 = streams.clone();
        let outgoing_tx2 = outgoing_tx.clone();
        let read_task = tokio::spawn(read_loop(ws_read, streams2, outgoing_tx2, accept_tx));

        let first_id = if is_server { 2 } else { 1 };

        Self {
            outgoing_tx,
            accept_rx: Mutex::new(accept_rx),
            next_stream_id: AtomicU32::new(first_id),
            streams,
            _read_task: read_task,
            _write_task: write_task,
        }
    }

    /// Open a new bidirectional stream (client side).
    pub async fn open_bi(&self) -> Result<(WsStreamWriter, WsStreamReader)> {
        let stream_id = self.next_stream_id.fetch_add(2, Ordering::Relaxed);

        // Create data channel for incoming data on this stream
        let (data_tx, data_rx) = mpsc::channel(256);
        self.streams.lock().await.insert(stream_id, data_tx);

        // Send OPEN frame
        let frame = encode_frame(FRAME_OPEN, stream_id, &[]);
        self.outgoing_tx
            .send(frame)
            .await
            .context("send OPEN frame")?;

        debug!(stream_id, "ws_mux: opened bi stream");

        let writer = WsStreamWriter {
            stream_id,
            outgoing_tx: self.outgoing_tx.clone(),
        };
        let reader = WsStreamReader {
            _stream_id: stream_id,
            rx: data_rx,
            buf: Vec::new(),
            pos: 0,
        };

        Ok((writer, reader))
    }

    /// Accept a new bidirectional stream from the remote side (server side).
    pub async fn accept_bi(&self) -> Result<(WsStreamWriter, WsStreamReader)> {
        self.accept_rx
            .lock()
            .await
            .recv()
            .await
            .context("WsMux closed")
    }

    /// Get a bidirectional pair for stream_id=0 (control stream).
    pub async fn control_stream(&self) -> (WsStreamWriter, WsStreamReader) {
        let stream_id = 0u32;
        let (data_tx, data_rx) = mpsc::channel(256);
        self.streams.lock().await.insert(stream_id, data_tx);

        let writer = WsStreamWriter {
            stream_id,
            outgoing_tx: self.outgoing_tx.clone(),
        };
        let reader = WsStreamReader {
            _stream_id: stream_id,
            rx: data_rx,
            buf: Vec::new(),
            pos: 0,
        };
        (writer, reader)
    }
}

// ─── Internal tasks ─────────────────────────────────────────────────────────

/// Write loop: reads encoded frames from the channel and sends them over WS.
async fn write_loop<S>(mut ws_write: S, mut outgoing_rx: mpsc::Receiver<Vec<u8>>)
where
    S: futures_util::Sink<Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin,
{
    while let Some(frame) = outgoing_rx.recv().await {
        if ws_write.send(Message::Binary(frame)).await.is_err() {
            debug!("ws_mux: write loop: WebSocket send failed");
            break;
        }
    }
    debug!("ws_mux: write loop exiting");
}

/// Read loop: reads from WebSocket and routes data to per-stream channels.
async fn read_loop<S>(
    mut ws_read: S,
    streams: Arc<Mutex<HashMap<u32, mpsc::Sender<Vec<u8>>>>>,
    outgoing_tx: mpsc::Sender<Vec<u8>>,
    accept_tx: mpsc::Sender<(WsStreamWriter, WsStreamReader)>,
) where
    S: futures_util::Stream<
            Item = std::result::Result<Message, tokio_tungstenite::tungstenite::Error>,
        > + Unpin,
{
    while let Some(msg) = ws_read.next().await {
        let data = match msg {
            Ok(Message::Binary(data)) => data,
            Ok(Message::Close(_)) => {
                debug!("ws_mux: received Close");
                break;
            }
            Ok(Message::Ping(_) | Message::Pong(_)) => continue,
            Ok(_) => continue,
            Err(e) => {
                warn!(error = %e, "ws_mux: read error");
                break;
            }
        };

        let (frame_type, stream_id, payload) = match decode_frame(&data) {
            Ok(f) => f,
            Err(e) => {
                warn!(error = %e, "ws_mux: bad frame");
                continue;
            }
        };

        match frame_type {
            FRAME_DATA => {
                let streams = streams.lock().await;
                if let Some(tx) = streams.get(&stream_id) {
                    if tx.send(payload.to_vec()).await.is_err() {
                        debug!(stream_id, "ws_mux: stream receiver dropped");
                    }
                } else {
                    debug!(stream_id, "ws_mux: data for unknown stream");
                }
            }
            FRAME_OPEN => {
                let (data_tx, data_rx) = mpsc::channel(256);
                streams.lock().await.insert(stream_id, data_tx);

                let writer = WsStreamWriter {
                    stream_id,
                    outgoing_tx: outgoing_tx.clone(),
                };
                let reader = WsStreamReader {
                    _stream_id: stream_id,
                    rx: data_rx,
                    buf: Vec::new(),
                    pos: 0,
                };

                if accept_tx.send((writer, reader)).await.is_err() {
                    debug!(stream_id, "ws_mux: accept channel closed");
                    break;
                }
                debug!(stream_id, "ws_mux: accepted stream");
            }
            FRAME_CLOSE => {
                streams.lock().await.remove(&stream_id);
                debug!(stream_id, "ws_mux: stream closed");
            }
            _ => {
                warn!(frame_type, "ws_mux: unknown frame type");
            }
        }
    }

    // Connection done — drop all stream senders to signal EOF
    streams.lock().await.clear();
    debug!("ws_mux: read loop exiting");
}

// ─── WsStreamWriter ────────────────────────────────────────────────────────

/// Write end of a multiplexed stream. Implements `AsyncWrite`.
pub struct WsStreamWriter {
    stream_id: u32,
    outgoing_tx: mpsc::Sender<Vec<u8>>,
}

impl AsyncWrite for WsStreamWriter {
    fn poll_write(
        self: Pin<&mut Self>,
        _cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        let frame = encode_frame(FRAME_DATA, self.stream_id, buf);
        match self.outgoing_tx.try_send(frame) {
            Ok(()) => Poll::Ready(Ok(buf.len())),
            Err(mpsc::error::TrySendError::Full(_)) => {
                // Channel full — caller should retry
                // We can't register a waker with try_send, so we return Pending
                // and rely on the caller's poll loop. In practice the 1024-deep
                // channel rarely fills.
                _cx.waker().wake_by_ref();
                Poll::Pending
            }
            Err(mpsc::error::TrySendError::Closed(_)) => Poll::Ready(Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "ws_mux outgoing channel closed",
            ))),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Poll::Ready(Ok(()))
    }

    fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        let frame = encode_frame(FRAME_CLOSE, self.stream_id, &[]);
        let _ = self.outgoing_tx.try_send(frame);
        Poll::Ready(Ok(()))
    }
}

// ─── WsStreamReader ────────────────────────────────────────────────────────

/// Read end of a multiplexed stream. Implements `AsyncRead`.
pub struct WsStreamReader {
    _stream_id: u32,
    rx: mpsc::Receiver<Vec<u8>>,
    /// Buffered chunk from the last recv.
    buf: Vec<u8>,
    /// Current read position in `buf`.
    pos: usize,
}

impl AsyncRead for WsStreamReader {
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        let this = self.get_mut();

        // Serve from buffered data first
        if this.pos < this.buf.len() {
            let remaining = &this.buf[this.pos..];
            let n = remaining.len().min(buf.remaining());
            buf.put_slice(&remaining[..n]);
            this.pos += n;
            if this.pos >= this.buf.len() {
                this.buf.clear();
                this.pos = 0;
            }
            return Poll::Ready(Ok(()));
        }

        // No buffered data — try to receive more
        match this.rx.poll_recv(cx) {
            Poll::Ready(Some(data)) => {
                let n = data.len().min(buf.remaining());
                buf.put_slice(&data[..n]);
                if n < data.len() {
                    // Save remainder
                    this.buf = data;
                    this.pos = n;
                }
                Poll::Ready(Ok(()))
            }
            Poll::Ready(None) => {
                // Channel closed = EOF
                Poll::Ready(Ok(()))
            }
            Poll::Pending => Poll::Pending,
        }
    }
}

// ─── WsBidi convenience wrapper ─────────────────────────────────────────────

/// Combines WsStreamWriter + WsStreamReader into a single AsyncRead + AsyncWrite,
/// like `QuicBidi` but for WebSocket multiplexed streams.
pub struct WsBidi {
    pub writer: WsStreamWriter,
    pub reader: WsStreamReader,
}

impl AsyncRead for WsBidi {
    #[inline]
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().reader).poll_read(cx, buf)
    }
}

impl AsyncWrite for WsBidi {
    #[inline]
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        Pin::new(&mut self.get_mut().writer).poll_write(cx, buf)
    }

    #[inline]
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().writer).poll_flush(cx)
    }

    #[inline]
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().writer).poll_shutdown(cx)
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode_data_frame() {
        let payload = b"hello world";
        let frame = encode_frame(FRAME_DATA, 42, payload);
        let (ft, sid, data) = decode_frame(&frame).unwrap();
        assert_eq!(ft, FRAME_DATA);
        assert_eq!(sid, 42);
        assert_eq!(data, payload);
    }

    #[test]
    fn test_encode_decode_open_frame() {
        let frame = encode_frame(FRAME_OPEN, 7, &[]);
        let (ft, sid, data) = decode_frame(&frame).unwrap();
        assert_eq!(ft, FRAME_OPEN);
        assert_eq!(sid, 7);
        assert!(data.is_empty());
    }

    #[test]
    fn test_encode_decode_close_frame() {
        let frame = encode_frame(FRAME_CLOSE, 99, &[]);
        let (ft, sid, data) = decode_frame(&frame).unwrap();
        assert_eq!(ft, FRAME_CLOSE);
        assert_eq!(sid, 99);
        assert!(data.is_empty());
    }

    #[test]
    fn test_decode_too_short() {
        assert!(decode_frame(&[0, 1, 2]).is_err());
        assert!(decode_frame(&[]).is_err());
    }

    #[test]
    fn test_stream_id_zero_control() {
        let frame = encode_frame(FRAME_DATA, 0, b"control msg");
        let (ft, sid, data) = decode_frame(&frame).unwrap();
        assert_eq!(ft, FRAME_DATA);
        assert_eq!(sid, 0);
        assert_eq!(data, b"control msg");
    }

    #[tokio::test]
    async fn test_mux_end_to_end() {
        // Create a pair of in-memory WebSocket streams using tokio channels
        let (client_tx, mut server_rx) = mpsc::channel::<Message>(64);
        let (server_tx, mut client_rx) = mpsc::channel::<Message>(64);

        // Build fake WS streams from channels
        let client_ws = FakeWs {
            tx: client_tx,
            rx: client_rx,
        };
        let server_ws = FakeWs {
            tx: server_tx,
            rx: server_rx,
        };

        let client_mux = Arc::new(WsMux::new(client_ws, false));
        let server_mux = Arc::new(WsMux::new(server_ws, true));

        // Client opens a stream
        let (mut cw, mut cr) = client_mux.open_bi().await.unwrap();

        // Server accepts it
        let (mut sw, mut sr) = server_mux.accept_bi().await.unwrap();

        // Client writes, server reads
        use tokio::io::{AsyncReadExt, AsyncWriteExt};
        cw.write_all(b"hello from client").await.unwrap();

        let mut buf = vec![0u8; 100];
        let n = sr.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"hello from client");

        // Server writes, client reads
        sw.write_all(b"hello from server").await.unwrap();

        let n = cr.read(&mut buf).await.unwrap();
        assert_eq!(&buf[..n], b"hello from server");
    }

    /// Fake WebSocket stream backed by mpsc channels, for testing.
    struct FakeWs {
        tx: mpsc::Sender<Message>,
        rx: mpsc::Receiver<Message>,
    }

    impl futures_util::Stream for FakeWs {
        type Item = std::result::Result<Message, tokio_tungstenite::tungstenite::Error>;

        fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
            match self.get_mut().rx.poll_recv(cx) {
                Poll::Ready(Some(msg)) => Poll::Ready(Some(Ok(msg))),
                Poll::Ready(None) => Poll::Ready(None),
                Poll::Pending => Poll::Pending,
            }
        }
    }

    impl futures_util::Sink<Message> for FakeWs {
        type Error = tokio_tungstenite::tungstenite::Error;

        fn poll_ready(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<std::result::Result<(), Self::Error>> {
            // Channel has capacity — just check if not closed
            if self.tx.is_closed() {
                Poll::Ready(Err(tokio_tungstenite::tungstenite::Error::ConnectionClosed))
            } else {
                Poll::Ready(Ok(()))
            }
        }

        fn start_send(self: Pin<&mut Self>, item: Message) -> std::result::Result<(), Self::Error> {
            self.get_mut().tx.try_send(item).map_err(|_| tokio_tungstenite::tungstenite::Error::ConnectionClosed)
        }

        fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<std::result::Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }

        fn poll_close(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<std::result::Result<(), Self::Error>> {
            Poll::Ready(Ok(()))
        }
    }
}
