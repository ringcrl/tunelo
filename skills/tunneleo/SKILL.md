---
name: tunneleo
description: Expose local services and files to the internet through a public HTTPS URL. Designed for AI agents — when you need to let a user preview files remotely, share a dev server, demo an app, or give temporary access to localhost. Use this whenever the user says "share this", "let me see it on my phone", "send me the link", or needs to access something running locally from another device/network.
---

## When to use tunneleo

Use tunneleo when the user needs to:
- **Preview files remotely** — "show me that PDF", "let me browse those files on my phone"
- **Share a local dev server** — "give me a link to your React app"
- **Demo something to a colleague** — "send me the URL so I can test it"
- **Access localhost from another device** — mobile testing, remote debugging
- **Share a directory** — project files, documents, media, datasets

Do NOT use tunneleo when:
- The user only needs local access (use `python3 -m http.server` or `tunneleo serve . --local`)
- The files are already hosted somewhere public

## Install

```bash
curl -fsSL https://agent-tunnel.woa.com/install.sh | sh
```

If `tunneleo` is not found after install, the binary is at `/usr/local/bin/tunneleo`.

## Commands

### Expose a local port

```bash
tunneleo port 3000                # Expose port 3000 → get public HTTPS URL
tunneleo port 5173                # React/Vite dev server
tunneleo port 8080                # Any local service
tunneleo port 3000 --password     # Auto-generate a password
tunneleo port 3000 --password mysecret  # Set a specific password
```

### Run a command and tunnel it

```bash
tunneleo port 3000 -- pnpm dev    # Start pnpm dev, wait for port 3000, then tunnel
tunneleo port 3000 -- next start  # Start Next.js and tunnel it
tunneleo port 5173 -- vite        # Start Vite and tunnel it
```

The child process gets `PORT` set in its environment. Tunneleo waits for the port to accept connections before creating the tunnel. When either the command or the tunnel stops, the other is cleaned up.

### Serve files with web explorer

```bash
tunneleo serve .                  # Current directory → public URL with file browser
tunneleo serve ./dist             # Specific directory
tunneleo serve README.md          # Single file
tunneleo serve index.html         # HTML file (rendered in browser)
tunneleo serve . --local          # Local-only preview (no tunnel, no public URL)
tunneleo serve . -l -p 8000       # Local preview on port 8000
```

The file explorer runs in the browser — directory browsing, code syntax highlighting, markdown rendering, PDF viewer, image/video/audio playback, CSV/Excel tables. Everything is embedded in the binary, no dependencies.

### Options

```bash
tunneleo port <PORT> --relay my.server:4433   # Use a custom relay server
tunneleo port <PORT> -H 192.168.1.100         # Forward to non-localhost
tunneleo port <PORT> --password               # Auto-generate a password
tunneleo port <PORT> --password mysecret      # Set a specific password
```

Default relay is `agent-tunnel.woa.com:4433` (free public relay). Use `--relay` for self-hosted.

## Typical agent workflows

### User says "share these files with me"

```bash
tunneleo serve /path/to/files
# Give the user the public URL from the output
```

### User says "I want to see this on my phone"

```bash
# If there's a dev server running:
tunneleo port 3000

# If it's just files:
tunneleo serve .
```

### User says "let my colleague test the API"

```bash
tunneleo port 8080 --password
# Give them the Share URL (includes password in the URL)
```

### User says "start the dev server and share it"

```bash
tunneleo port 3000 -- pnpm dev
# Starts the dev server, waits for port, creates tunnel
```

### User says "preview this locally first"

```bash
tunneleo serve ./dist --local
# Opens on http://localhost:3000, no public URL
```

## How it works

```
Browser → HTTPS → Relay → QUIC tunnel → Client → localhost / file server
```

- Public HTTPS URL assigned automatically (random subdomain like `swift-fox-3847.agent-tunnel.woa.com`)
- QUIC transport — encrypted, multiplexed, low latency
- Auto-reconnects if connection drops
- Session limit: tunnels expire after ~2 hours on the public relay
