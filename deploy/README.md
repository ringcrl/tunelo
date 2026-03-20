# Tunelo Deployment Guide

Deploy tunelo to UK VPS (`130.162.188.52`) with domain `tunelo.net`.

## Architecture

```
              Cloudflare DNS (DNS-only, no proxy)
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  tunelo.net      *.tunelo.net     UDP:4433
        │               │               │
   ┌─────────────────────────┐    ┌──────────┐
   │    nginx (port 80/443)  │    │  tunelo   │
   │    TLS termination      │    │  relay    │
   │    Let's Encrypt cert   │    │  (QUIC)   │
   ├─────────┬───────────────┤    │  :4433    │
   │ tunelo  │ *.tunelo.net  │    └──────────┘
   │  .net   │ proxy → :8080 │
   │ website │               │
   └─────────┴───────┬───────┘
                     ▼
             ┌──────────────┐
             │ tunelo relay │
             │  HTTP :8080  │
             │  QUIC :4433  │
             └──────────────┘
```

## Quick Deploy

```bash
# From local machine:
./deploy/04-deploy.sh
```

## Steps

### Step 0: Oracle Cloud Security List

Open ports in Oracle Cloud Console → Networking → Virtual Cloud Networks → Security Lists:

| Source CIDR | Protocol | Dest Port | Description |
|-------------|----------|-----------|-------------|
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | UDP | 4433 | QUIC tunnels |

### Step 1: Configure Cloudflare DNS

See `02-cloudflare-dns.md`.

### Step 2: Setup VPS

```bash
ssh ukvps
bash 01-setup-vps.sh
```

### Step 3: Get Let's Encrypt Certificate

```bash
ssh ukvps
bash 03-letsencrypt.sh YOUR_CLOUDFLARE_API_TOKEN
```

### Step 4: Build & Deploy

```bash
./deploy/04-deploy.sh
```

## Maintenance

```bash
# View logs
ssh ukvps "sudo journalctl -u tunelo-relay -f"

# Restart
ssh ukvps "sudo systemctl restart tunelo-relay"

# Renew certificate
ssh ukvps "sudo certbot renew"

# Redeploy after code changes
./deploy/04-deploy.sh
```

## Files

| File | Purpose |
|------|---------|
| `01-setup-vps.sh` | Install nginx, certbot, create dirs |
| `02-cloudflare-dns.md` | Cloudflare DNS setup instructions |
| `03-letsencrypt.sh` | Get wildcard SSL cert via DNS-01 |
| `04-deploy.sh` | Build, upload, and install everything |
| `tunelo.net.conf` | Nginx config for TLS + proxy |
| `tunelo-relay.service` | Systemd unit (runs `tunelo relay`) |
