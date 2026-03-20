#!/bin/bash
# ============================================================
# Step 3: Let's Encrypt Wildcard Certificate
# Run on the VPS after setting up Cloudflare API token
# ============================================================
set -euo pipefail

# --- EDIT THIS: Your Cloudflare API token ---
CF_API_TOKEN="${1:?Usage: $0 <cloudflare-api-token>}"

echo "=== 1. Create Cloudflare credentials file ==="
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini > /dev/null <<EOF
dns_cloudflare_api_token = ${CF_API_TOKEN}
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

echo "=== 2. Request wildcard certificate ==="
sudo certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d "tunelo.net" \
    -d "*.tunelo.net" \
    --email admin@tunelo.net \
    --agree-tos \
    --non-interactive

echo "=== 3. Verify certificate ==="
sudo ls -la /etc/letsencrypt/live/tunelo.net/
echo ""
echo "Certificate files:"
echo "  Cert:      /etc/letsencrypt/live/tunelo.net/fullchain.pem"
echo "  Key:       /etc/letsencrypt/live/tunelo.net/privkey.pem"

echo ""
echo "=== 4. Auto-renewal is set up by certbot ==="
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

echo ""
echo "=== 5. Set up post-renewal hook to reload nginx ==="
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'HOOK'
#!/bin/bash
systemctl reload nginx
HOOK
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh

echo ""
echo "=== Done! Certificate will auto-renew every ~60 days ==="
