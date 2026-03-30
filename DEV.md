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

你需要：一台公网 VPS（Ubuntu/Debian）+ 域名 `agent-tunnel.woa.com` 已解析到服务器。

### 架构

```
浏览器
  │ HTTPS
  ▼
Caddy (443)            tunelo relay (QUIC :4433, WS :4434)
  │ TLS 终结                 ▲
  │                          │ 客户端通过 QUIC/WS 连入
  │ agent-tunnel.woa.com     │
  │   → 静态站点 (落地页)    │
  │ *.agent-tunnel.woa.com   │
  │   → reverse_proxy :8080  │
  ▼                          │
tunelo relay (HTTP :8080) ───┘
```

- `agent-tunnel.woa.com` — 主站，部署 `website/` 构建产物（静态 HTML 落地页）
- `*.agent-tunnel.woa.com` — 泛域名，反代到 relay，用于用户隧道的 HTTP/WebSocket 转发

---

### Step 1: DNS 解析

添加两条 A 记录：

| 类型 | 名称 | 值 |
|------|------|-----|
| A | `agent-tunnel` | 服务器 IP |
| A | `*.agent-tunnel` | 服务器 IP |

验证：

```bash
dig agent-tunnel.woa.com +short        # 应返回服务器 IP
dig test.agent-tunnel.woa.com +short   # 同上
```

---

### Step 2: 服务器初始化

```bash
# 防火墙放行（云厂商还需在安全组里放行这些端口）
sudo iptables -I INPUT 5 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 5 -p udp --dport 4433 -j ACCEPT
sudo iptables -I INPUT 5 -p tcp --dport 4434 -j ACCEPT
sudo apt-get install -y iptables-persistent
sudo netfilter-persistent save

# 安装 Caddy（https://github.com/caddyserver/caddy/releases）
# Linux amd64:
curl -OL https://github.com/caddyserver/caddy/releases/download/v2.11.2/caddy_2.11.2_linux_amd64.tar.gz
tar xzf caddy_2.11.2_linux_amd64.tar.gz caddy
sudo mv caddy /usr/bin/caddy && sudo chmod +x /usr/bin/caddy
rm -f caddy_2.11.2_linux_amd64.tar.gz
# Linux arm64:
# curl -OL https://github.com/caddyserver/caddy/releases/download/v2.11.2/caddy_2.11.2_linux_arm64.tar.gz
# macOS arm64 (Apple Silicon):
# curl -OL https://github.com/caddyserver/caddy/releases/download/v2.11.2/caddy_2.11.2_mac_arm64.tar.gz

# 创建目录
sudo mkdir -p /opt/tunelo/bin /opt/tunelo/website /etc/caddy /etc/ssl/tunelo
```

---

### Step 3: 准备 SSL 证书

将已有的证书文件放到服务器上：

```bash
sudo cp fullchain.pem /etc/ssl/tunelo/fullchain.pem
sudo cp privkey.pem /etc/ssl/tunelo/privkey.pem
```

---

### Step 4: 配置 Caddy

创建 `/etc/caddy/Caddyfile`：

```caddyfile
# 主站 — 落地页静态网站
agent-tunnel.woa.com {
    root * /opt/tunelo/website
    file_server
    try_files {path} /index.html

    tls /etc/ssl/tunelo/fullchain.pem /etc/ssl/tunelo/privkey.pem
}

# 泛域名 — 隧道 HTTP/WebSocket 反代
*.agent-tunnel.woa.com {
    reverse_proxy 127.0.0.1:8080

    tls /etc/ssl/tunelo/fullchain.pem /etc/ssl/tunelo/privkey.pem
}
```

启动 Caddy：

```bash
# 创建 systemd 服务
sudo tee /etc/systemd/system/caddy.service << 'EOF'
[Unit]
Description=Caddy
After=network.target

[Service]
ExecStart=/usr/bin/caddy run --config /etc/caddy/Caddyfile
ExecReload=/usr/bin/caddy reload --config /etc/caddy/Caddyfile
Restart=always
RestartSec=5
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl start caddy
```

---

### Step 5: 编译并上传 tunelo

本地交叉编译：

```bash
cd web && pnpm install && pnpm build && cd ..

# arm64 服务器：
cargo build --release --target aarch64-unknown-linux-musl --bin tunelo
# x86_64 服务器：
# cargo build --release --target x86_64-unknown-linux-musl --bin tunelo
```

上传二进制和落地页：

```bash
scp target/aarch64-unknown-linux-musl/release/tunelo your-vps:/tmp/tunelo
ssh your-vps "sudo mv /tmp/tunelo /opt/tunelo/bin/tunelo && sudo chmod +x /opt/tunelo/bin/tunelo"

cd website && pnpm install && pnpm build && cd ..
scp -r website/dist/* your-vps:/tmp/tunelo-website/
ssh your-vps "sudo cp -r /tmp/tunelo-website/* /opt/tunelo/website/ && rm -rf /tmp/tunelo-website"
```

---

### Step 6: 配置 tunelo relay 服务

创建 `/etc/systemd/system/tunelo-relay.service`：

```ini
[Unit]
Description=Tunelo Relay Server
After=network-online.target

[Service]
ExecStart=/opt/tunelo/bin/tunelo relay \
    --domain agent-tunnel.woa.com \
    --tunnel-addr 0.0.0.0:4433 \
    --http-addr 127.0.0.1:8080 \
    --ws-tunnel-addr 0.0.0.0:4434
Restart=always
RestartSec=5
Environment=RUST_LOG=tunelo=info,tunelo_relay=info

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tunelo-relay
sudo systemctl start tunelo-relay
```

---

### Step 7: 验证

```bash
python3 -m http.server 3000
tunelo port 3000 --relay agent-tunnel.woa.com:4433
```

看到类似输出就说明部署成功：

```
Tunnel is ready.

Public URL:  https://calm-river-9012.agent-tunnel.woa.com
Forwarding:  http://localhost:3000
```

---

### 日常运维

```bash
sudo journalctl -u tunelo-relay -f   # relay 日志
sudo journalctl -u caddy -f          # caddy 日志
sudo systemctl restart tunelo-relay   # 重启 relay
sudo systemctl reload caddy           # 更新证书后重载
```

---

### 客户端使用

```bash
# QUIC 传输（默认）
tunelo port 3000 --relay agent-tunnel.woa.com:4433

# WebSocket 传输（UDP 被封锁时）
tunelo port 3000 --transport ws --ws-relay wss://agent-tunnel.woa.com:4434

# 密码保护
tunelo port 3000 --relay agent-tunnel.woa.com:4433 --password

# 文件服务
tunelo serve . --relay agent-tunnel.woa.com:4433

# 边运行命令边建隧道
tunelo port 3000 --relay agent-tunnel.woa.com:4433 -- pnpm dev
```
