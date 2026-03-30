//! Data-plane relay — bidirectional byte copy between tunnel and localhost.
//!
//! ZERO parsing. Raw bytes in, raw bytes out.
//! Supports both QUIC streams and WebSocket multiplexed streams.

use std::pin::Pin;
use std::task::{Context, Poll};

use anyhow::{Context as _, Result};
use tokio::io::{self, AsyncRead, AsyncWrite, ReadBuf};
use tokio::net::TcpStream;
use tracing::debug;

use tunneleo_protocol::{WsBidi, WsStreamReader, WsStreamWriter};

/// Relay one QUIC data stream to localhost and back.
pub async fn handle_data_stream(
    send: quinn::SendStream,
    recv: quinn::RecvStream,
    local_addr: &str,
) -> Result<()> {
    let mut local = TcpStream::connect(local_addr)
        .await
        .context("connect local")?;
    local.set_nodelay(true)?;

    let mut tunnel = QuicBidi { send, recv };

    match io::copy_bidirectional(&mut local, &mut tunnel).await {
        Ok((up, down)) => debug!(up, down, "relay done"),
        Err(e) => debug!(error = %e, "relay ended"),
    }
    Ok(())
}

/// Relay one WebSocket multiplexed data stream to localhost and back.
pub async fn handle_ws_data_stream(
    writer: WsStreamWriter,
    reader: WsStreamReader,
    local_addr: &str,
) -> Result<()> {
    let mut local = TcpStream::connect(local_addr)
        .await
        .context("connect local")?;
    local.set_nodelay(true)?;

    let mut tunnel = WsBidi { writer, reader };

    match io::copy_bidirectional(&mut local, &mut tunnel).await {
        Ok((up, down)) => debug!(up, down, "WS relay done"),
        Err(e) => debug!(error = %e, "WS relay ended"),
    }
    Ok(())
}

/// Combines QUIC Send+Recv streams into a single AsyncRead+AsyncWrite.
struct QuicBidi {
    send: quinn::SendStream,
    recv: quinn::RecvStream,
}

impl AsyncRead for QuicBidi {
    #[inline]
    fn poll_read(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        Pin::new(&mut self.get_mut().recv).poll_read(cx, buf)
    }
}

impl AsyncWrite for QuicBidi {
    #[inline]
    fn poll_write(
        self: Pin<&mut Self>,
        cx: &mut Context<'_>,
        buf: &[u8],
    ) -> Poll<io::Result<usize>> {
        <quinn::SendStream as AsyncWrite>::poll_write(
            Pin::new(&mut self.get_mut().send),
            cx,
            buf,
        )
    }

    #[inline]
    fn poll_flush(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        <quinn::SendStream as AsyncWrite>::poll_flush(
            Pin::new(&mut self.get_mut().send),
            cx,
        )
    }

    #[inline]
    fn poll_shutdown(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<io::Result<()>> {
        <quinn::SendStream as AsyncWrite>::poll_shutdown(
            Pin::new(&mut self.get_mut().send),
            cx,
        )
    }
}
