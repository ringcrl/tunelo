# Tunneleo

将任何东西暴露到互联网 —— 本地端口、文件、目录。

```
$ tunneleo port 3000
  Tunnel is ready.

  Public URL:  https://swift-fox-3847.agent-tunnel.woa.com
  Forwarding:  http://localhost:3000
```

```
$ tunneleo serve .
  Serving /Users/you/project on :51234
  Tunnel is ready.

  Public URL:  https://calm-river-9012.agent-tunnel.woa.com
  Forwarding:  http://127.0.0.1:51234
```

## 架构

```
浏览器 → HTTPS → 中继服务器 → QUIC 流 → 客户端 → localhost:3000
                  (8 MB)                  (8 MB)

浏览器 → HTTPS → 中继服务器 → WS 多路复用流 → 客户端 → localhost:3000
                  (8 MB)      (备用传输)       (8 MB)
```

- **QUIC 隧道** (quinn + rustls) —— 多路复用、加密、低延迟（默认）
- **WebSocket 隧道** (tokio-tungstenite) —— 当 UDP 被封锁时的 TCP 备用传输，通过单个 WebSocket 连接实现流多路复用
- **WebSocket 透传** —— 浏览器 WebSocket 连接（如 Vite HMR、socket.io）可透明地通过隧道转发
- **零拷贝数据面** —— 在 TCP 和隧道流之间使用 `copy_bidirectional`
- **内置文件服务器** —— 嵌入式 React Web 浏览器，支持代码/Markdown/PDF/图片/视频/音频/CSV/Excel 预览
- **客户端与中继解耦** —— 客户端默认连接 `agent-tunnel.woa.com`，也可自建中继服务器
- **单一二进制** —— `tunneleo port`、`tunneleo serve`、`tunneleo relay` —— 客户端和服务端合为一体

## 安装

**macOS / Linux：**
```bash
curl -fsSL https://agent-tunnel.woa.com/install.sh | sh
```

**Windows (PowerShell)：**
```powershell
irm https://agent-tunnel.woa.com/install.ps1 | iex
```

### 支持的平台

| 操作系统 | 架构 | 二进制文件 |
|---------|------|-----------|
| Linux | x86_64 / arm64 | `tunneleo-linux-amd64` / `tunneleo-linux-arm64` |
| macOS | x86_64 / arm64 | `tunneleo-macos-amd64` / `tunneleo-macos-arm64` |
| Windows | x86_64 | `tunneleo-windows-amd64.exe` |

## 快速开始

```bash
# 暴露本地服务（默认使用 agent-tunnel.woa.com 公共中继）
tunneleo port 3000

# 密码保护的隧道
tunneleo port 3000 --password
tunneleo port 3000 --password mysecret

# 通过 Web 浏览器提供目录服务
tunneleo serve .

# 仅本地预览（不创建隧道）
tunneleo serve . --local
```

## 自建部署

```bash
# 在任意 VPS 上运行自己的中继服务器
tunneleo relay --domain yourdomain.com

# 启用 WebSocket 隧道端点（用于 UDP 被封锁的客户端）
tunneleo relay --domain yourdomain.com --ws-tunnel-addr 0.0.0.0:4434

# 将客户端指向你的中继服务器
tunneleo port 3000 --relay yourdomain.com:4433

# 使用 WebSocket 传输（当 UDP/QUIC 被封锁时）
tunneleo port 3000 --transport ws --ws-relay ws://yourdomain.com:4434
```

### 生产部署

你需要：一台公网 VPS（Ubuntu/Debian）+ 域名 `agent-tunnel.woa.com` 已解析到服务器。

#### 架构

```
浏览器
  │ HTTPS
  ▼
Caddy (443)            tunneleo relay (QUIC :4433, WS :4434)
  │ TLS 终结                 ▲
  │                          │ 客户端通过 QUIC/WS 连入
  │ agent-tunnel.woa.com     │
  │   → 静态站点 (落地页)    │
  │ *.agent-tunnel.woa.com   │
  │   → reverse_proxy :8080  │
  ▼                          │
tunneleo relay (HTTP :8080) ───┘
```

- `agent-tunnel.woa.com` — 主站，部署 `website/` 构建产物（静态 HTML 落地页）
- `*.agent-tunnel.woa.com` — 泛域名，反代到 relay，用于用户隧道的 HTTP/WebSocket 转发

---

#### Step 1: DNS 解析

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

#### Step 2: 服务器初始化

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
sudo mkdir -p /opt/tunneleo/bin /opt/tunneleo/website /etc/caddy /etc/ssl/tunneleo
```

---

#### Step 3: 准备 SSL 证书

将已有的证书文件放到服务器上：

```bash
sudo cp fullchain.pem /etc/ssl/tunneleo/fullchain.pem
sudo cp privkey.pem /etc/ssl/tunneleo/privkey.pem
```

---

#### Step 4: 配置 Caddy

创建 `/etc/caddy/Caddyfile`：

```caddyfile
# 主站 — 落地页静态网站
agent-tunnel.woa.com {
    root * /opt/tunneleo/website
    file_server
    try_files {path} /index.html

    tls /etc/ssl/tunneleo/fullchain.pem /etc/ssl/tunneleo/privkey.pem
}

# 泛域名 — 隧道 HTTP/WebSocket 反代
*.agent-tunnel.woa.com {
    reverse_proxy 127.0.0.1:8080

    tls /etc/ssl/tunneleo/fullchain.pem /etc/ssl/tunneleo/privkey.pem
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

#### Step 5: 编译并上传 tunneleo

本地交叉编译：

```bash
cd web && pnpm install && pnpm build && cd ..

# arm64 服务器：
cargo build --release --target aarch64-unknown-linux-musl --bin tunneleo
# x86_64 服务器：
# cargo build --release --target x86_64-unknown-linux-musl --bin tunneleo
```

上传二进制和落地页：

```bash
scp target/aarch64-unknown-linux-musl/release/tunneleo your-vps:/tmp/tunneleo
ssh your-vps "sudo mv /tmp/tunneleo /opt/tunneleo/bin/tunneleo && sudo chmod +x /opt/tunneleo/bin/tunneleo"

cd website && pnpm install && pnpm build && cd ..
scp -r website/dist/* your-vps:/tmp/tunneleo-website/
ssh your-vps "sudo cp -r /tmp/tunneleo-website/* /opt/tunneleo/website/ && rm -rf /tmp/tunneleo-website"
```

---

#### Step 6: 配置 tunneleo relay 服务

创建 `/etc/systemd/system/tunneleo-relay.service`：

```ini
[Unit]
Description=Tunneleo Relay Server
After=network-online.target

[Service]
ExecStart=/opt/tunneleo/bin/tunneleo relay \
    --domain agent-tunnel.woa.com \
    --tunnel-addr 0.0.0.0:4433 \
    --http-addr 127.0.0.1:8080 \
    --ws-tunnel-addr 0.0.0.0:4434
Restart=always
RestartSec=5
Environment=RUST_LOG=tunneleo=info,tunneleo_relay=info

[Install]
WantedBy=multi-user.target
```

启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable tunneleo-relay
sudo systemctl start tunneleo-relay
```

---

#### Step 7: 验证

```bash
python3 -m http.server 3000
tunneleo port 3000 --relay agent-tunnel.woa.com:4433
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
sudo journalctl -u tunneleo-relay -f   # relay 日志
sudo journalctl -u caddy -f          # caddy 日志
sudo systemctl restart tunneleo-relay   # 重启 relay
sudo systemctl reload caddy           # 更新证书后重载
```

---

### 客户端使用

```bash
# QUIC 传输（默认）
tunneleo port 3000 --relay agent-tunnel.woa.com:4433

# WebSocket 传输（UDP 被封锁时）
tunneleo port 3000 --transport ws --ws-relay wss://agent-tunnel.woa.com:4434

# 密码保护
tunneleo port 3000 --relay agent-tunnel.woa.com:4433 --password

# 文件服务
tunneleo serve . --relay agent-tunnel.woa.com:4433

# 边运行命令边建隧道
tunneleo port 3000 --relay agent-tunnel.woa.com:4433 -- pnpm dev
```

## 命令行

```
tunneleo port <PORT>                          # 暴露本地端口
tunneleo port <PORT> --relay host:4433        # 自定义中继服务器
tunneleo port <PORT> -H 0.0.0.0              # 转发到非 localhost 地址
tunneleo port <PORT> --password               # 私有隧道（自动生成密码）
tunneleo port <PORT> --password mysecret      # 私有隧道（指定密码）
tunneleo port <PORT> -- pnpm dev              # 运行命令并创建隧道
tunneleo port <PORT> -- next start            # 运行 Next.js 并创建隧道
tunneleo port 5173 -- vite                    # 运行 Vite 并创建隧道

tunneleo port <PORT> --transport ws            # 使用 WebSocket 传输
tunneleo port <PORT> --transport ws \
  --ws-relay ws://host:4434                  # 自定义 WS 中继地址

tunneleo serve .                              # 提供当前目录
tunneleo serve ./dist                         # 提供指定目录
tunneleo serve README.md                      # 提供单个文件
tunneleo serve index.html                     # 提供 HTML 文件
tunneleo serve . --local                      # 仅本地预览（不创建隧道）
tunneleo serve . -l -p 8000                   # 在端口 8000 上本地预览

tunneleo relay                                # 使用默认配置启动中继
tunneleo relay --domain agent-tunnel.woa.com            # 生产环境域名
tunneleo relay --tunnel-addr 0.0.0.0:4433     # QUIC 监听地址
tunneleo relay --http-addr 0.0.0.0:80         # HTTP 监听地址
tunneleo relay --ws-tunnel-addr 0.0.0.0:4434  # WebSocket 隧道监听地址
```

## 文件服务器

运行 `tunneleo serve` 时，tunneleo 会启动内置文件服务器，功能包括：

- **Web 文件浏览器** —— 浏览目录，面包屑导航
- **文件预览** —— 语法高亮代码、渲染 Markdown、PDF 查看器、图片/视频/音频播放器、CSV/Excel 表格
- **范围请求** —— 支持大文件流式传输和媒体拖动播放
- **嵌入式前端** —— React 应用编译进二进制文件，零外部依赖

## 局域网开发测试

在局域网内使用两台电脑测试 Tunneleo 的隧道能力（含 WebSocket 传输）。

### 环境准备

| 角色 | 说明 |
|------|------|
| **电脑 A** | 中继服务器 (Relay) |
| **电脑 B** | 客户端 (Client)，运行本地 Web 服务 |

两台电脑需在同一局域网下，且能互相 ping 通。

#### 编译

两台电脑都需要编译（或在一台编译后把二进制拷贝过去）：

```bash
cargo build --release
# 产物在 target/release/tunneleo
```

#### 获取电脑 A 的局域网 IP

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# Linux
ip addr show | grep "inet "
```

以下示例假设电脑 A 的 IP 为 `192.168.1.100`，请替换为实际值。

### 启动中继服务器（电脑 A）

```bash
./target/release/tunneleo relay \
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

### 建立隧道（电脑 B）

#### 启动本地 Web 服务

```bash
# 任选一种
python3 -m http.server 3000
npx serve -p 3000
pnpm dev --port 3000   # Vite 项目
```

#### QUIC 传输（默认）

```bash
./target/release/tunneleo port 3000 --relay 192.168.1.100:4433
```

#### WebSocket 传输

```bash
./target/release/tunneleo port 3000 \
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

### WebSocket 能力测试

#### 测试 1: WS 隧道传输 vs QUIC 传输对比

分别用两种传输方式建立隧道，对比连接速度和响应延迟：

```bash
# QUIC
./target/release/tunneleo port 3000 --relay 192.168.1.100:4433

# WebSocket
./target/release/tunneleo port 3000 \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434
```

#### 测试 2: WebSocket 透传（Vite HMR 热更新）

验证浏览器的 WebSocket 连接能穿透隧道，最典型的场景是 Vite HMR：

```bash
# 电脑 B: 启动 Vite 并建立 WS 隧道
./target/release/tunneleo port 5173 \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434 \
  -- pnpm dev
```

在电脑 A 的浏览器访问隧道 URL，然后在电脑 B 修改源代码，观察电脑 A 的浏览器是否实时热更新。HMR 正常工作说明 WebSocket 透传成功。

#### 测试 3: 文件服务器

```bash
./target/release/tunneleo serve . \
  --transport ws \
  --ws-relay ws://192.168.1.100:4434
```

在电脑 A 浏览器中浏览文件目录、预览代码/图片/视频等。

### 故障排查

| 问题 | 排查方法 |
|------|----------|
| 两台电脑不通 | `ping 192.168.1.100` |
| 端口被防火墙拦截 | 确保 4433/UDP、4434/TCP、8080/TCP 已放行 |
| 客户端连不上中继 | 检查 relay 是否正常启动，IP 和端口是否正确 |
| HMR 不工作 | 确认 Vite 的 WebSocket 端口与隧道端口一致 |

macOS 临时关闭防火墙：**系统设置 → 网络 → 防火墙 → 关闭**。

## 项目结构

```
crates/
  protocol/     共享协议类型 + 编解码器
  relay/        中继服务器（库）
  tunneleo/       主二进制文件（客户端 + 中继子命令）
web/            文件浏览器前端（嵌入到二进制文件中）
website/        着陆页（agent-tunnel.woa.com）
```

## 性能

| 指标 | 数值 |
|------|------|
| 中继内存 | 8 MB RSS |
| 隧道开销 | 相比直连约 ~14% |
| 吞吐量 | ~670 请求/秒（本地） |
| 二进制大小 | ~4 MB |
