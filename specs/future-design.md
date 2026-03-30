# Future Design: Multi-Region Relay

## Problem

A tunnel is registered on one relay server. If a browser request arrives at a different relay, it can't find the tunnel. Single-server architecture doesn't scale to multiple regions.

## Approach: Client Multi-Connect (inspired by Tailscale DERP)

Every relay server is a fully independent node. The client connects to **all** relays simultaneously and registers the same subdomain on each. Any relay can serve browser requests directly — no cross-relay forwarding needed.

```
                    ┌─────────────┐
              QUIC  │  EU relay   │  ← browser (EU visitor)
           ┌───────▶│  :4433      │
           │        └─────────────┘
           │
┌──────────┤        ┌─────────────┐
│  tunneleo  │  QUIC  │  US relay   │  ← browser (US visitor)
│  client  ├───────▶│  :4433      │
│          │        └─────────────┘
└──────────┤
           │        ┌─────────────┐
           │  QUIC  │  JP relay   │  ← browser (JP visitor)
           └───────▶│  :4433      │
                    └─────────────┘
```

Browser → GeoDNS → nearest relay → relay already has the tunnel → direct forward to client over QUIC.

## How it works

1. Client starts: `tunneleo port 3000`
2. Client fetches relay list from a discovery endpoint (e.g. `https://agent-tunnel.woa.com/relays.json`)
3. Client opens QUIC connections to all relays, registers the same subdomain on each
4. Each relay independently accepts browser requests and forwards them through its own QUIC connection to the client
5. GeoDNS (Cloudflare Load Balancer or Route 53 Geolocation) routes `*.agent-tunnel.woa.com` to the nearest relay

## Relay discovery

A simple static JSON served from the website:

```json
// https://agent-tunnel.woa.com/relays.json
{
  "relays": [
    { "id": "eu", "addr": "eu.agent-tunnel.woa.com:4433", "location": "London" },
    { "id": "us", "addr": "us.agent-tunnel.woa.com:4433", "location": "Virginia" },
    { "id": "jp", "addr": "jp.agent-tunnel.woa.com:4433", "location": "Tokyo" }
  ]
}
```

No coordination service. No Redis. No etcd. Just a JSON file updated when you add a new VPS.

## Subdomain consistency

All relays must assign the **same subdomain** for the same tunnel. Two options:

**Option A: Client requests a specific subdomain.** Client generates the subdomain locally (e.g. `warm-shelf-8694`) and sends it in the Register message. Each relay accepts it (or rejects if taken by someone else). This is simpler but requires adding a `requested_subdomain` field back to the protocol.

**Option B: First relay assigns, client replicates.** Client connects to the nearest relay first, gets assigned `warm-shelf-8694`, then registers that same subdomain on all other relays. Slightly more complex connection logic but no protocol change needed.

Option A is better — simpler, no ordering dependency.

## DNS setup

Single wildcard with GeoDNS routing:

```
*.agent-tunnel.woa.com  →  EU visitor → 130.162.188.52 (London)
*.agent-tunnel.woa.com  →  US visitor → 1.2.3.4        (Virginia)
*.agent-tunnel.woa.com  →  JP visitor → 5.6.7.8        (Tokyo)
```

Use Cloudflare Load Balancer ($5/mo) or AWS Route 53 Geolocation Routing.

## Failure handling

- If one relay goes down, client detects disconnect and keeps serving through the remaining relays
- GeoDNS health checks remove the dead relay from DNS
- Client periodically retries connecting to failed relays
- If a client can only reach one relay (firewall, etc.), it still works — just without multi-region coverage

## What changes in the codebase

### Protocol

Add `requested_subdomain` to `ClientControl::Register`:

```rust
Register {
    version: u8,
    password: Option<String>,
    requested_subdomain: Option<String>,  // new
}
```

Relay: if `requested_subdomain` is set and available, use it. Otherwise generate a random one.

### Client (`tunnel.rs`)

Current: single `run_tunnel()` connecting to one relay.

New: `run_multi_tunnel()` that:
1. Fetches relay list from discovery endpoint
2. Spawns a `run_tunnel()` per relay, all sharing the same subdomain
3. Any one succeeding is enough; all succeeding gives full coverage
4. Manages reconnection per relay independently

### Relay

No changes. Each relay is completely unaware of other relays.

## Cost estimate

Each relay is a minimal VPS:
- Oracle Cloud free tier: 4 ARM cores, 24 GB RAM (enough for thousands of tunnels)
- Hetzner: €4/mo for a small VPS
- Total for 3 regions: ~€8-12/mo

GeoDNS:
- Cloudflare Load Balancer: $5/mo
- Or Route 53 Geolocation: ~$0.70/mo per record

## Implementation order

1. Add `requested_subdomain` to protocol (small change)
2. Add `/relays.json` to website
3. Refactor client to connect to multiple relays
4. Deploy second relay on a different continent
5. Set up GeoDNS
6. Test cross-region latency

## Why this over ngrok-style central routing

| | Central routing (ngrok) | Client multi-connect (this) |
|---|---|---|
| Relay coordination | Required (Redis/etcd) | None |
| Cross-relay forwarding | Required | None |
| Single point of failure | Central registry | None |
| Client complexity | Simple (one connection) | Medium (N connections) |
| Relay complexity | High (forwarding logic) | Zero (fully independent) |
| Latency | Extra hop for cross-region | Always direct |
| Operational cost | Higher (coordination infra) | Lower (just VPS + DNS) |

The key insight from Tailscale DERP: push the complexity to the client, keep the servers dumb and independent. The client already handles reconnection logic — connecting to N relays instead of 1 is a straightforward extension.
