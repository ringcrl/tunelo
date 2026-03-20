---
name: tunelo
description: Expose local services to the internet through a public HTTPS URL using tunelo. Use this when you need to share a local dev server, demo an app, or give someone temporary access to localhost.
---

## Quick Start

```bash
# Expose a local HTTP service on port 3000
tunelo http 3000

# Output:
#   ✔ Tunnel is ready!
#   Public URL:  https://abc123.tunelo.net
#   Forwarding:  → http://localhost:3000
```

## Install

```bash
# Download the binary (Linux amd64)
curl -fsSL https://tunelo.net/install.sh | sh

# Or build from source
cargo install tunelo-client
```

## Commands

### Expose a local service

```bash
tunelo http <PORT>                            # Expose HTTP service
tunelo http <PORT> --subdomain myapp          # Request specific subdomain
tunelo http <PORT> --gateway tunelo.net:4433  # Custom gateway (default: tunelo.net)
tunelo http <PORT> -H 0.0.0.0                # Forward to non-localhost host
```

### Common examples

```bash
# Share a React dev server
tunelo http 5173

# Share a Python server with a custom subdomain
tunelo http 8000 --subdomain demo

# Expose an API server
tunelo http 3001 --subdomain api

# Forward to a different host on your network
tunelo http 8080 -H 192.168.1.100
```

## How It Works

```
Browser → HTTPS → tunelo.net gateway → QUIC stream → tunelo client → localhost:PORT
```

1. Client opens a QUIC tunnel to the gateway
2. Gateway assigns a public subdomain (`abc123.tunelo.net`)
3. When a browser hits that URL, traffic is relayed through the tunnel to your localhost
4. Zero-copy data plane — no buffering, low overhead (~14% vs direct)

## Tips

- The tunnel stays open as long as the `tunelo` process is running
- Press `Ctrl+C` to close the tunnel
- Subdomains are first-come-first-served; use `--subdomain` to request a specific one
- The public URL is HTTPS — TLS is terminated at the gateway
- QUIC transport means multiplexed, encrypted, low-latency tunneling
