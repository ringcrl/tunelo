#!/bin/bash
# ============================================================
# Step 1: VPS Initial Setup
# Run on the VPS (ssh ukvps, then run this)
# ============================================================
set -euo pipefail

echo "=== 1. Open firewall ports ==="
# HTTP
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
# HTTPS
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
# QUIC (UDP for tunnel clients)
sudo iptables -I INPUT 5 -p udp --dport 4433 -j ACCEPT

# Persist iptables rules
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

echo "=== 2. Install nginx ==="
sudo apt-get update
sudo apt-get install -y nginx

echo "=== 3. Install certbot with Cloudflare plugin ==="
sudo apt-get install -y certbot python3-certbot-dns-cloudflare

echo "=== 4. Create tunelo user and directories ==="
sudo useradd --system --shell /usr/sbin/nologin tunelo || true
sudo mkdir -p /opt/tunelo/bin
sudo mkdir -p /opt/tunelo/web
sudo mkdir -p /etc/tunelo

echo "=== Done! ==="
echo ""
echo "IMPORTANT: You also need to open ports 80, 443 (TCP) and 4433 (UDP)"
echo "in Oracle Cloud Console → Networking → Virtual Cloud Networks"
echo "→ Security Lists → Add Ingress Rules:"
echo "  - Source: 0.0.0.0/0, Protocol: TCP, Dest Port: 80"
echo "  - Source: 0.0.0.0/0, Protocol: TCP, Dest Port: 443"
echo "  - Source: 0.0.0.0/0, Protocol: UDP, Dest Port: 4433"
