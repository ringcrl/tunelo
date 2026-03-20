# Tunelo

Expose local services to the internet through a public URL.

```
$ tunelo http 3000
  ✔ Tunnel is ready!

  Public URL:  https://abc123.tunelo.net
  Forwarding:  → http://localhost:3000
```

## Architecture

```
Browser → HTTPS → Gateway → QUIC stream → Client → localhost:3000
                  (8 MB)                   (8 MB)
```

- **QUIC tunnel** (quinn + rustls) — multiplexed, encrypted, low-latency
- **Zero-copy data plane** — `copy_bidirectional` between TCP and QUIC streams
- **1,165 lines of Rust** across 9 source files

## Quick Start

```bash
# Build
cargo build --release

# Terminal 1: Start the gateway
./target/release/tunelo-gateway --domain localhost

# Terminal 2: Start your local service
python3 -m http.server 3000

# Terminal 3: Create a tunnel
./target/release/tunelo http 3000 --gateway 127.0.0.1:4433 --subdomain myapp

# Terminal 4: Test it
curl -H "Host: myapp.localhost" http://127.0.0.1:8080/
```

## CLI

### Client

```
tunelo http <PORT>                          # Expose HTTP service
tunelo http <PORT> --subdomain myapp        # Request specific subdomain
tunelo http <PORT> --gateway host:4433      # Custom gateway
tunelo http <PORT> -H 0.0.0.0              # Forward to non-localhost
```

### Gateway

```
tunelo-gateway                              # Start with defaults
tunelo-gateway --domain tunelo.net          # Production domain
tunelo-gateway --tunnel-addr 0.0.0.0:4433   # QUIC listener
tunelo-gateway --http-addr 0.0.0.0:80       # HTTP listener
```

## Project Structure

```
tunelo-protocol/    Shared protocol types + codec (163 lines)
tunelo-client/      CLI + tunnel client (353 lines)
tunelo-gateway/     Gateway server (649 lines)
```

## Performance

| Metric | Value |
|--------|-------|
| Gateway memory | 8 MB RSS |
| Tunnel overhead | ~14% vs direct |
| Throughput | ~670 req/s (localhost) |
| Binary size | 3.3–3.5 MB |

## License

MIT
