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

## 生产部署

你需要：一台公网 VPS（Ubuntu/Debian）+ 一个自己的域名。以下用 `example.com` 代指，请全部替换为你的实际域名。

### 架构

```
浏览器
  │ HTTPS
  ▼
Nginx (443)          tunelo relay (QUIC :4433, WS :4434)
  │ TLS 终结               ▲
  │ *.example.com           │ 客户端通过 QUIC/WS 连入
  │ proxy_pass :8080        │
  ▼                         │
tunelo relay (HTTP :8080) ──┘
```

Nginx 做 TLS 终结 + 泛域名反代；relay 从 Host 头提取子域名路由到对应隧道。

---

### Step 1: DNS 解析

在域名管理后台（阿里云 / 腾讯云 / Namesilo / GoDaddy 等）添加两条 A 记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| A | `@` | 你的服务器 IP |
| A | `*` | 你的服务器 IP |

不需要开 CDN / 代理，直接解析到服务器 IP。

验证：

```bash
dig example.com +short        # 应返回你的 IP
dig test.example.com +short   # 同上
```

---

### Step 2: 服务器初始化

SSH 登录 VPS：

```bash
# 防火墙放行
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -p udp --dport 4433 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 4434 -j ACCEPT

# 持久化 iptables
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# 安装 Nginx 和 Certbot
sudo apt-get update
sudo apt-get install -y nginx certbot

# 创建 tunelo 用户和目录
sudo useradd --system --shell /usr/sbin/nologin tunelo || true
sudo mkdir -p /opt/tunelo/bin /opt/tunelo/website
```

> 云厂商（AWS / Oracle / 阿里云等）还需在控制台**安全组**里放行 80/TCP、443/TCP、4433/UDP、4434/TCP。

---

### Step 3: 申请泛域名 SSL 证书

泛域名证书必须用 DNS-01 验证。运行：

```bash
sudo certbot certonly \
    --manual \
    --preferred-challenges dns \
    -d "example.com" \
    -d "*.example.com" \
    --email you@example.com \
    --agree-tos
```

certbot 会提示你添加 TXT 记录：

```
Please deploy a DNS TXT record under the name:
  _acme-challenge.example.com
with the following value:
  xXxXxXxXxXxXxXxXxXx
```

**操作**：

1. **先不要按回车**，去域名后台添加 TXT 记录（名称 `_acme-challenge`，值为提示的那串字符）
2. 等 1-5 分钟，验证生效：`dig TXT _acme-challenge.example.com +short`
3. 确认有返回后，回到终端**按回车**
4. certbot 可能会再提示一次（给 `*.example.com`），重复上述操作

> 两条 `_acme-challenge` TXT 记录的值不同，大多数 DNS 服务商支持同名多条 TXT，都加上即可。

签发成功后配置自动续期：

```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 续期后自动 reload Nginx
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat << 'EOF' | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
#!/bin/bash
systemctl reload nginx
EOF
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

> 手动模式的证书续期时仍需手动加 TXT。如需全自动，可用 [acme.sh](https://github.com/acmesh-official/acme.sh)，支持几十种 DNS 服务商 API。

---

### Step 4: 配置 Nginx

创建配置文件 `/etc/nginx/sites-available/example.com`：

```nginx
# HTTP → HTTPS 重定向
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

# 主站
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    root /opt/tunelo/website;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}

# 隧道子域名 → relay
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name *.example.com;

    ssl_certificate     /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket 透传
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # 长连接超时
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;

        # 关闭缓冲
        proxy_buffering off;
        proxy_request_buffering off;
    }
}
```

启用：

```bash
sudo ln -sf /etc/nginx/sites-available/example.com /etc/nginx/sites-enabled/example.com
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

### Step 5: 编译并上传 tunelo

在本地 macOS 交叉编译：

```bash
# 先构建前端（编译时会嵌入二进制）
cd web && pnpm install && pnpm build && cd ..

# arm64 服务器：
cargo build --release --target aarch64-unknown-linux-musl --bin tunelo
# x86_64 服务器：
# cargo build --release --target x86_64-unknown-linux-musl --bin tunelo
```

上传：

```bash
scp target/aarch64-unknown-linux-musl/release/tunelo your-vps:/tmp/tunelo

ssh your-vps "
  sudo mv /tmp/tunelo /opt/tunelo/bin/tunelo
  sudo chmod +x /opt/tunelo/bin/tunelo
  sudo chown tunelo:tunelo /opt/tunelo/bin/tunelo
"
```

如果有落地页网站，也一并上传：

```bash
cd website && pnpm install && pnpm build && cd ..
scp -r website/dist/* your-vps:/tmp/tunelo-website/

ssh your-vps "
  sudo rm -rf /opt/tunelo/website/*
  sudo cp -r /tmp/tunelo-website/* /opt/tunelo/website/
  sudo chown -R tunelo:tunelo /opt/tunelo/website/
  rm -rf /tmp/tunelo-website
"
```

---

### Step 6: 配置 systemd 服务

在 VPS 上创建 `/etc/systemd/system/tunelo-relay.service`：

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

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/opt/tunelo

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tunelo-relay
sudo systemctl start tunelo-relay
sudo systemctl status tunelo-relay   # 确认 active (running)
```

---

### Step 7: 验证

在你本地电脑上：

```bash
# 启动一个测试服务
python3 -m http.server 3000

# 建立隧道（指向你自己的 relay）
tunelo port 3000 --relay example.com:4433
```

看到类似输出就说明部署成功：

```
Tunnel is ready.

Public URL:  https://calm-river-9012.example.com
Forwarding:  http://localhost:3000
```

在浏览器访问 `https://calm-river-9012.example.com` 验证。

---

### 日常运维

```bash
# 查看实时日志
sudo journalctl -u tunelo-relay -f

# 重启服务
sudo systemctl restart tunelo-relay

# 更新二进制后重启
sudo systemctl restart tunelo-relay

# 手动续期证书（按提示添加 TXT 记录）
sudo certbot renew
```

---

### 客户端使用

```bash
# QUIC 传输（默认）
tunelo port 3000 --relay example.com:4433

# WebSocket 传输（UDP 被封锁时）
tunelo port 3000 --transport ws --ws-relay wss://example.com:4434

# 密码保护
tunelo port 3000 --relay example.com:4433 --password

# 文件服务
tunelo serve . --relay example.com:4433

# 边运行命令边建隧道
tunelo port 3000 --relay example.com:4433 -- pnpm dev
```
