# Tunelo

Expose anything to the internet — local ports, files, directories.

```
$ tunelo port 3000
  Tunnel is ready.

  Public URL:  https://swift-fox-3847.tunelo.net
  Forwarding:  http://localhost:3000
```

```
$ tunelo serve .
  Serving /Users/you/project on :51234
  Tunnel is ready.

  Public URL:  https://calm-river-9012.tunelo.net
  Forwarding:  http://127.0.0.1:51234
```

## Architecture

```
Browser → HTTPS → Relay → QUIC stream → Client → localhost:3000
                 (8 MB)                  (8 MB)
```

- **QUIC tunnel** (quinn + rustls) — multiplexed, encrypted, low-latency
- **Zero-copy data plane** — `copy_bidirectional` between TCP and QUIC streams
- **Built-in file server** — embedded React web explorer with viewers for code/markdown/PDF/images/video/audio/CSV/Excel
- **Decoupled client + relay** — client defaults to `tunelo.net`, or self-host your own relay
- **One binary** — `tunelo port`, `tunelo serve`, `tunelo relay` — client and server in one

## Quick Start

```bash
# Build
cargo build --release

# Terminal 1: Start a relay (or use the public one at tunelo.net)
./target/release/tunelo relay --domain localhost

# Terminal 2: Expose a local service
./target/release/tunelo port 3000

# Or run a command and tunnel it
./target/release/tunelo port 3000 -- pnpm dev

# Or serve a directory
./target/release/tunelo serve .

# Or just preview locally (no tunnel)
./target/release/tunelo serve . --local
```

## CLI

```
tunelo port <PORT>                          # Expose local port
tunelo port <PORT> --relay host:4433        # Custom relay server
tunelo port <PORT> -H 0.0.0.0              # Forward to non-localhost
tunelo port <PORT> --password               # Private tunnel (auto-generated password)
tunelo port <PORT> --password mysecret      # Private tunnel (specific password)
tunelo port <PORT> -- pnpm dev              # Run command and tunnel it
tunelo port <PORT> -- next start            # Run Next.js and tunnel it
tunelo port 5173 -- vite                    # Run Vite and tunnel it

tunelo serve .                              # Serve current directory
tunelo serve ./dist                         # Serve a specific directory
tunelo serve README.md                      # Serve a single file
tunelo serve index.html                     # Serve an HTML file
tunelo serve . --local                      # Local-only preview (no tunnel)
tunelo serve . -l -p 8000                   # Local preview on port 8000

tunelo relay                                # Start relay with defaults
tunelo relay --domain tunelo.net            # Production domain
tunelo relay --tunnel-addr 0.0.0.0:4433     # QUIC listener
tunelo relay --http-addr 0.0.0.0:80         # HTTP listener
```

## File Server

When you run `tunelo serve`, tunelo starts a built-in file server with:

- **Web Explorer** — browse directories, navigate with breadcrumbs
- **File viewers** — syntax-highlighted code, rendered markdown, PDF viewer, image/video/audio players, CSV/Excel tables
- **Range requests** — streaming support for large files and media seeking
- **Embedded frontend** — the React app is compiled into the binary, zero external dependencies

## Docker

```bash
docker run -d -p 8080:8080 -p 4433:4433/udp \
  tunelo/tunelo relay --domain yourdomain.com
```

Or with docker-compose:

```bash
docker compose up -d
```

## Project Structure

```
crates/
  protocol/     Shared protocol types + codec
  relay/        Relay server (lib)
  tunelo/       Main binary (client + relay subcommand)
web/            File explorer frontend (embedded into binary)
website/        Landing page (tunelo.net)
deploy/         VPS deployment scripts + configs
skills/         AI agent skill (SKILL.md)
```

## Performance

| Metric | Value |
|--------|-------|
| Relay memory | 8 MB RSS |
| Tunnel overhead | ~14% vs direct |
| Throughput | ~670 req/s (localhost) |
| Binary size | ~4 MB |

## License

MIT
