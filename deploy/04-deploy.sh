#!/bin/bash
# ============================================================
# Step 4: Build and Deploy Tunelo
# Run from your local machine (macOS)
#
# Deploys two separate web apps:
#   - website/dist → /opt/tunelo/website  (tunelo.net landing page)
#   - web/dist     → /opt/tunelo/web      (*.tunelo.net file explorer)
# ============================================================
set -euo pipefail

VPS="ukvps"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== 1. Cross-compile tunelo-gateway for aarch64-linux ==="
cd "$PROJECT_DIR"
cargo build --release --target aarch64-unknown-linux-musl --bin tunelo-gateway

echo ""
echo "=== 2. Build landing page (tunelo.net) ==="
cd "$PROJECT_DIR/website"
pnpm install
pnpm build

echo ""
echo "=== 3. Upload binary ==="
scp "$PROJECT_DIR/target/aarch64-unknown-linux-musl/release/tunelo-gateway" \
    ${VPS}:/tmp/tunelo-gateway

echo ""
echo "=== 4. Upload website ==="
scp -r "$PROJECT_DIR/website/dist" ${VPS}:/tmp/tunelo-website

echo ""
echo "=== 5. Upload nginx config and systemd service ==="
scp "$PROJECT_DIR/deploy/tunelo.net.conf" ${VPS}:/tmp/tunelo.net.conf
scp "$PROJECT_DIR/deploy/tunelo-gateway.service" ${VPS}:/tmp/tunelo-gateway.service

echo ""
echo "=== 6. Install on VPS ==="
ssh ${VPS} bash -s <<'REMOTE'
set -euo pipefail

# Install binary
sudo mv /tmp/tunelo-gateway /opt/tunelo/bin/tunelo-gateway
sudo chmod +x /opt/tunelo/bin/tunelo-gateway
sudo chown tunelo:tunelo /opt/tunelo/bin/tunelo-gateway

# Install landing page
sudo mkdir -p /opt/tunelo/landing
sudo rm -rf /opt/tunelo/landing/*
sudo cp -r /tmp/tunelo-landing/* /opt/tunelo/landing/
sudo chown -R tunelo:tunelo /opt/tunelo/landing/
rm -rf /tmp/tunelo-landing

# Install nginx config
sudo mv /tmp/tunelo.net.conf /etc/nginx/sites-available/tunelo.net
sudo ln -sf /etc/nginx/sites-available/tunelo.net /etc/nginx/sites-enabled/tunelo.net
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# Install systemd service
sudo mv /tmp/tunelo-gateway.service /etc/systemd/system/tunelo-gateway.service
sudo systemctl daemon-reload
sudo systemctl enable tunelo-gateway
sudo systemctl restart tunelo-gateway

echo ""
echo "=== Service Status ==="
sudo systemctl status tunelo-gateway --no-pager -l
REMOTE

echo ""
echo "=== Deploy complete! ==="
echo ""
echo "  https://tunelo.net              → Landing page"
echo "  *.tunelo.net                    → Tunnel subdomains"
echo "  tunelo http 3000 --gateway tunelo.net:4433"
