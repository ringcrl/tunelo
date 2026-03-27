# Tunelo 开发测试指南

本文档介绍如何在局域网内使用两台电脑测试 Tunelo 的隧道能力（含 WebSocket 传输）。

## 环境准备

| 角色 | 说明 |
|------|------|
| **电脑 A** | 中继服务器 (Relay) |
| **电脑 B** | 客户端 (Client)，运行本地 Web 服务 |

两台电脑需在同一局域网下，且能互相 ping 通。

### 编译

两台电脑都需要编译（或在一台编译后把二进制拷贝过去）：

```bash
cargo build --release
# 产物在 target/release/tunelo
```

### 获取电脑 A 的局域网 IP

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux
ip addr show | grep "inet "
```

以下示例假设电脑 A 的 IP 为 `192.168.1.100`，请替换为实际值。

## 启动中继服务器（电脑 A）

```bash
./target/release/tunelo relay \
  --domain 192.168.1.100 \
  --tunnel-addr 0.0.0.0:4433 \
  --http-addr 0.0.0.0:8080 \
  --ws-tunnel-addr 0.0.0.0:4434
```

| 端口 | 协议 | 用途 |
|------|------|------|
| 4433/UDP | QUIC | 默认隧道传输 |
| 4434/TCP | WebSocket | 备用隧道传输（UDP 被封锁时） |
| 8080/TCP | HTTP | 浏览器访问入口 |

## 建立隧道（电脑 B）

### 启动本地 Web 服务

```bash
# 任选一种
python3 -m http.server 3000
npx serve -p 3000
pnpm dev --port 3000   # Vite 项目
```

### QUIC 传输（默认）

```bash
./target/release/tunelo port 3000 --relay 192.168.1.100:4433
```

### WebSocket 传输

```bash
./target/release/tunelo port 3000 \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434
```

成功后会看到：

```
Tunnel is ready.

Public URL:  http://192.168.1.100:8080
Forwarding:  http://localhost:3000
```

在电脑 A（或局域网任意设备）的浏览器访问 Public URL 即可。

## WebSocket 能力测试

### 测试 1: WS 隧道传输 vs QUIC 传输对比

分别用两种传输方式建立隧道，对比连接速度和响应延迟：

```bash
# QUIC
./target/release/tunelo port 3000 --relay 192.168.1.100:4433

# WebSocket
./target/release/tunelo port 3000 \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434
```

### 测试 2: WebSocket 透传（Vite HMR 热更新）

验证浏览器的 WebSocket 连接能穿透隧道，最典型的场景是 Vite HMR：

```bash
# 电脑 B: 启动 Vite 并建立 WS 隧道
./target/release/tunelo port 5173 \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434 \
  -- pnpm dev
```

在电脑 A 的浏览器访问隧道 URL，然后在电脑 B 修改源代码，观察电脑 A 的浏览器是否实时热更新。HMR 正常工作说明 WebSocket 透传成功。

### 测试 3: 文件服务器

```bash
./target/release/tunelo serve . \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434
```

在电脑 A 浏览器中浏览文件目录、预览代码/图片/视频等。

## 故障排查

| 问题 | 排查方法 |
|------|----------|
| 两台电脑不通 | `ping 192.168.1.100` |
| 端口被防火墙拦截 | 确保 4433/UDP、4434/TCP、8080/TCP 已放行 |
| 客户端连不上中继 | 检查 relay 是否正常启动，IP 和端口是否正确 |
| HMR 不工作 | 确认 Vite 的 WebSocket 端口与隧道端口一致 |

macOS 临时关闭防火墙：**系统设置 → 网络 → 防火墙 → 关闭**。

---

## 生产部署：泛域名上线

假设你已经有一台公网服务器（VPS）和一个域名（以 `example.com` 为例），以下是完整的上线流程。

### 架构总览

```
              Cloudflare DNS (DNS only, 不开代理)
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
  example.com     *.example.com     UDP:4433
        │               │               │
   ┌─────────────────────────┐    ┌──────────┐
   │    Nginx (80/443)       │    │  tunelo   │
   │    TLS 终结             │    │  relay    │
   │    Let's Encrypt 证书    │    │  (QUIC)   │
   ├─────────┬───────────────┤    │  :4433    │
   │ 主站    │ *.example.com │    └──────────┘
   │ 落地页  │ proxy → :8080 │
   └─────────┴───────┬───────┘
                     ▼
             ┌──────────────┐
             │ tunelo relay │
             │  HTTP :8080  │
             │  QUIC :4433  │
             │  WS   :4434  │
             └──────────────┘
```

**关键原理**：Nginx 负责 TLS 终结，将 `*.example.com` 的请求反代给 relay 的 HTTP 端口；relay 从 Host 头提取子域名（如 `calm-river-9012`）路由到对应隧道。

### Step 1: 配置 Cloudflare DNS

在 Cloudflare 控制台为你的域名添加两条 DNS 记录：

| 类型 | 名称 | 内容 | 代理状态 | TTL |
|------|------|------|----------|-----|
| A | `@` | `你的服务器IP` | **仅 DNS**（灰色云朵） | Auto |
| A | `*` | `你的服务器IP` | **仅 DNS**（灰色云朵） | Auto |

> ⚠️ **必须选"仅 DNS"（灰色云朵），不能开"已代理"（橙色云朵）**：
> - Cloudflare 免费版不支持泛域名代理
> - TLS 需要在你的服务器上终结（不是 Cloudflare）
> - QUIC (UDP:4433) 无法穿过 Cloudflare 代理

然后获取 Cloudflare API Token（用于 Let's Encrypt DNS-01 验证）：

1. Cloudflare 控制台 → **我的个人资料** → **API 令牌**
2. 点击 **创建令牌**，使用 **编辑区域 DNS** 模板
3. 权限：Zone → DNS → Edit，区域：选择你的域名
4. 创建后**复制令牌**，下一步要用

### Step 2: VPS 初始化

SSH 登录服务器，安装基础软件并开放防火墙端口：

```bash
# 开放端口
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -p udp --dport 4433 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 4434 -j ACCEPT   # WebSocket 隧道

# 持久化规则
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# 安装 Nginx + Certbot
sudo apt-get update
sudo apt-get install -y nginx certbot python3-certbot-dns-cloudflare

# 创建 tunelo 用户和目录
sudo useradd --system --shell /usr/sbin/nologin tunelo || true
sudo mkdir -p /opt/tunelo/bin /opt/tunelo/web /etc/tunelo
```

> 如果是云厂商（AWS/Oracle/阿里云等），还需在控制台安全组里放行 80/TCP、443/TCP、4433/UDP、4434/TCP。

### Step 3: 申请 Let's Encrypt 泛域名证书

泛域名证书必须用 **DNS-01 验证**（不能用 HTTP 验证），所以需要 Cloudflare API Token：

```bash
# 保存 Cloudflare 凭证
sudo mkdir -p /etc/letsencrypt
sudo tee /etc/letsencrypt/cloudflare.ini > /dev/null <<EOF
dns_cloudflare_api_token = 你的_CLOUDFLARE_API_TOKEN
EOF
sudo chmod 600 /etc/letsencrypt/cloudflare.ini

# 申请泛域名证书
sudo certbot certonly \
    --dns-cloudflare \
    --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini \
    --dns-cloudflare-propagation-seconds 30 \
    -d "example.com" \
    -d "*.example.com" \
    --email admin@example.com \
    --agree-tos \
    --non-interactive

# 启用自动续期
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 续期后自动 reload Nginx
sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh > /dev/null <<'HOOK'
#!/bin/bash
systemctl reload nginx
HOOK
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

证书文件位置：
- 证书链：`/etc/letsencrypt/live/example.com/fullchain.pem`
- 私钥：`/etc/letsencrypt/live/example.com/privkey.pem`

### Step 4: 配置 Nginx

创建 `/etc/nginx/sites-available/example.com`：

```nginx
# ── HTTP → HTTPS 重定向 ─────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name example.com *.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── 主站：example.com ───────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    root /opt/tunelo/website;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# ── 隧道子域名：*.example.com → relay:8080 ──────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        # 传递原始 Host 头（隧道路由的关键！）
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 透传支持
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 长连接超时
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        # 关闭缓冲，支持流式传输
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

启用配置：

```bash
sudo ln -sf /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/example.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### Step 5: 部署 Relay 服务

**交叉编译**（在本地 macOS 上，目标为 Linux）：

```bash
cargo build --release --target aarch64-unknown-linux-musl --bin tunelo
# 或 x86_64：
# cargo build --release --target x86_64-unknown-linux-musl --bin tunelo
```

**上传到服务器**：

```bash
scp target/aarch64-unknown-linux-musl/release/tunelo your-vps:/tmp/tunelo
ssh your-vps "sudo mv /tmp/tunelo /opt/tunelo/bin/tunelo && sudo chmod +x /opt/tunelo/bin/tunelo && sudo chown tunelo:tunelo /opt/tunelo/bin/tunelo"
```

**创建 systemd 服务** `/etc/systemd/system/tunelo-relay.service`：

```ini
[Unit]
Description=Tunelo Relay Server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=tunelo
Group=tunelo
ExecStart=/opt/tunelo/bin/tunelo relay \
    --domain example.com \
    --tunnel-addr 0.0.0.0:4433 \
    --http-addr 127.0.0.1:8080 \
    --ws-tunnel-addr 0.0.0.0:4434
Restart=always
RestartSec=5
Environment=RUST_LOG=tunelo=info,tunelo_relay=info

# 安全加固
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/tunelo

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tunelo-relay
sudo systemctl start tunelo-relay
sudo systemctl status tunelo-relay
```

### Step 6: 客户端使用

部署完成后，任何人都可以用以下命令创建隧道：

```bash
# QUIC 传输（默认，推荐）
tunelo port 3000

# WebSocket 传输（UDP 被封锁时）
tunelo port 3000 --transport ws --ws-relay wss://example.com:4434

# 密码保护
tunelo port 3000 --password

# 文件服务
tunelo serve .
```

隧道建立后会输出：

```
Tunnel is ready.

Public URL:  https://calm-river-9012.example.com
Forwarding:  http://localhost:3000
```

任何人在浏览器访问 `https://calm-river-9012.example.com` 即可访问你的本地服务。

### 一键部署

项目已提供部署脚本，修改 `deploy/04-deploy.sh` 中的 VPS 地址后可一键部署：

```bash
./deploy/04-deploy.sh
```

### 运维命令

```bash
# 查看实时日志
ssh your-vps "sudo journalctl -u tunelo-relay -f"

# 重启服务
ssh your-vps "sudo systemctl restart tunelo-relay"

# 手动续期证书
ssh your-vps "sudo certbot renew"

# 代码更新后重新部署
./deploy/04-deploy.sh
```

### Docker 部署（可选）

也可以用 Docker 部署 relay：

```bash
docker run -d -p 8080:8080 -p 4433:4433/udp -p 4434:4434 \
  tunelo/tunelo relay \
  --domain example.com \
  --ws-tunnel-addr 0.0.0.0:4434
```

或使用 docker-compose：

```bash
docker compose up -d
```

> ⚠️ Docker 方式仍需 Nginx 在宿主机做 TLS 终结和泛域名反代。
