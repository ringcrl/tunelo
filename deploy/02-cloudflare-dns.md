# Cloudflare DNS Configuration for tunelo.net

## Step 1: Add DNS Records

Go to **Cloudflare Dashboard** → `tunelo.net` → **DNS** → **Records** → **Add record**:

| Type | Name | Content | Proxy status | TTL |
|------|------|---------|-------------|-----|
| A | `@` | `130.162.188.52` | **DNS only** (grey cloud) | Auto |
| A | `*` | `130.162.188.52` | **DNS only** (grey cloud) | Auto |

> ⚠️ **MUST be "DNS only" (grey cloud)**, NOT "Proxied" (orange cloud):
> - Wildcard proxy is Enterprise-only on Cloudflare
> - We need Let's Encrypt to terminate TLS on our server (not Cloudflare)
> - QUIC (UDP:4433) can't go through Cloudflare proxy

## Step 2: Get Cloudflare API Token (for Let's Encrypt DNS-01 challenge)

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Use the **Edit zone DNS** template:
   - **Permissions**: Zone → DNS → Edit
   - **Zone Resources**: Include → Specific zone → `tunelo.net`
4. Click **Continue to summary** → **Create Token**
5. **Copy the token** — you'll need it for certbot

## Step 3: SSL/TLS Settings

Since we're using "DNS only" mode, Cloudflare is just a DNS provider.
TLS is handled entirely by nginx + Let's Encrypt on our server.

No SSL settings needed in Cloudflare for this setup.
