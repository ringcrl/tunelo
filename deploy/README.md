# Tunelo Deployment Guide

Deploy tunelo-relay to UK VPS (`130.162.188.52`) with domain `tunelo.net`.

## Architecture

```
                    Cloudflare DNS (DNS-only, no proxy)
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        tunelo.net      *.tunelo.net     UDP:4433
              │               │               │
              ▼               ▼               ▼
         ┌─────────────────────────┐    ┌──────────┐
         │    nginx (port 80/443)  │    │  tunelo   │
         │    TLS termination      │    │  relay  │
         │    Let's Encrypt cert   │    │  (QUIC)   │
         ├─────────┬───────────────┤    │  :4433    │
         │ tunelo  │  *.tunelo.net │    └──────────┘
         │  .net   │  proxy → :8080│
         │ static  │               │
         │ files   │               │
         └─────────┴───────┬───────┘
                           ▼
                   ┌──────────────┐
                   │tunelo-relay│
                   │  HTTP :8080  │
                   │  QUIC :4433  │
                   └──────────────┘
```

## Steps

### Step 0: Oracle Cloud Security List

⚠️ **Before anything else**, open ports in Oracle Cloud Console:

1. Go to **Networking** → **Virtual Cloud Networks** → your VCN → **Security Lists**
2. Add **Ingress Rules**:

| Source CIDR | Protocol | Dest Port | Description |
|-------------|----------|-----------|-------------|
| 0.0.0.0/0 | TCP | 80 | HTTP |
| 0.0.0.0/0 | TCP | 443 | HTTPS |
| 0.0.0.0/0 | UDP | 4433 | QUIC tunnels |

### Step 1: Configure Cloudflare DNS

Follow `02-cloudflare-dns.md`:
- Add `A` record: `@` → `130.162.188.52` (DNS only)
- Add `A` record: `*` → `130.162.188.52` (DNS only)
- Create API token with DNS edit permissions

### Step 2: Setup VPS

```bash
ssh ukvps
# Upload and run:
bash 01-setup-vps.sh
```

### Step 3: Get Let's Encrypt Certificate

```bash
ssh ukvps
bash 03-letsencrypt.sh YOUR_CLOUDFLARE_API_TOKEN
```

### Step 4: Build & Deploy

```bash
# From local machine:
./deploy/04-deploy.sh
```

### Step 5: Verify

```bash
# Check services
ssh ukvps "sudo systemctl status tunelo-relay nginx"

# Test landing page
curl https://tunelo.net

# Test tunnel (from local machine)
python3 -m http.server 3000 &
./target/release/tunelo http 3000 --relay tunelo.net:4433
# Then visit the URL it gives you
```

## Maintenance

```bash
# View logs
ssh ukvps "sudo journalctl -u tunelo-relay -f"

# Restart relay
ssh ukvps "sudo systemctl restart tunelo-relay"

# Renew certificate (auto via timer, but manual if needed)
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
| `nginx-tunelo.conf` | Nginx config for TLS + proxy |
| `tunelo-relay.service` | Systemd unit file |
