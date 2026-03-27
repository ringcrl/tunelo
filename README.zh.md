# Tunelo

将任何东西暴露到互联网 —— 本地端口、文件、目录。

```
$ tunelo port 3000
  Tunnel is ready.

  Public URL:  https://swift-fox-3847.tunelo.net
  Forwarding:  http://localhost:3000
```

```
$ tunelo serve .
  Serving /Users/you/project on :51234
  Tunnel is ready.

  Public URL:  https://calm-river-9012.tunelo.net
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
- **客户端与中继解耦** —— 客户端默认连接 `tunelo.net`，也可自建中继服务器
- **单一二进制** —— `tunelo port`、`tunelo serve`、`tunelo relay` —— 客户端和服务端合为一体

## 安装

**macOS / Linux：**
```bash
curl -fsSL https://tunelo.net/install.sh | sh
```

**Windows (PowerShell)：**
```powershell
irm https://tunelo.net/install.ps1 | iex
```

### 支持的平台

| 操作系统 | 架构 | 二进制文件 |
|---------|------|-----------|
| Linux | x86_64 / arm64 | `tunelo-linux-amd64` / `tunelo-linux-arm64` |
| macOS | x86_64 / arm64 | `tunelo-macos-amd64` / `tunelo-macos-arm64` |
| Windows | x86_64 | `tunelo-windows-amd64.exe` |

## 快速开始

```bash
# 暴露本地服务（默认使用 tunelo.net 公共中继）
tunelo port 3000

# 密码保护的隧道
tunelo port 3000 --password
tunelo port 3000 --password mysecret

# 通过 Web 浏览器提供目录服务
tunelo serve .

# 仅本地预览（不创建隧道）
tunelo serve . --local
```

## 自建部署

```bash
# 在任意 VPS 上运行自己的中继服务器
tunelo relay --domain yourdomain.com

# 启用 WebSocket 隧道端点（用于 UDP 被封锁的客户端）
tunelo relay --domain yourdomain.com --ws-tunnel-addr 0.0.0.0:4434

# 将客户端指向你的中继服务器
tunelo port 3000 --relay yourdomain.com:4433

# 使用 WebSocket 传输（当 UDP/QUIC 被封锁时）
tunelo port 3000 --transport ws --ws-relay ws://yourdomain.com:4434
```

## 命令行

```
tunelo port <PORT>                          # 暴露本地端口
tunelo port <PORT> --relay host:4433        # 自定义中继服务器
tunelo port <PORT> -H 0.0.0.0              # 转发到非 localhost 地址
tunelo port <PORT> --password               # 私有隧道（自动生成密码）
tunelo port <PORT> --password mysecret      # 私有隧道（指定密码）
tunelo port <PORT> -- pnpm dev              # 运行命令并创建隧道
tunelo port <PORT> -- next start            # 运行 Next.js 并创建隧道
tunelo port 5173 -- vite                    # 运行 Vite 并创建隧道

tunelo port <PORT> --transport ws            # 使用 WebSocket 传输
tunelo port <PORT> --transport ws \
  --ws-relay ws://host:4434                  # 自定义 WS 中继地址

tunelo serve .                              # 提供当前目录
tunelo serve ./dist                         # 提供指定目录
tunelo serve README.md                      # 提供单个文件
tunelo serve index.html                     # 提供 HTML 文件
tunelo serve . --local                      # 仅本地预览（不创建隧道）
tunelo serve . -l -p 8000                   # 在端口 8000 上本地预览

tunelo relay                                # 使用默认配置启动中继
tunelo relay --domain tunelo.net            # 生产环境域名
tunelo relay --tunnel-addr 0.0.0.0:4433     # QUIC 监听地址
tunelo relay --http-addr 0.0.0.0:80         # HTTP 监听地址
tunelo relay --ws-tunnel-addr 0.0.0.0:4434  # WebSocket 隧道监听地址
```

## 文件服务器

运行 `tunelo serve` 时，tunelo 会启动内置文件服务器，功能包括：

- **Web 文件浏览器** —— 浏览目录，面包屑导航
- **文件预览** —— 语法高亮代码、渲染 Markdown、PDF 查看器、图片/视频/音频播放器、CSV/Excel 表格
- **范围请求** —— 支持大文件流式传输和媒体拖动播放
- **嵌入式前端** —— React 应用编译进二进制文件，零外部依赖

## Docker

```bash
docker run -d -p 8080:8080 -p 4433:4433/udp -p 4434:4434 \
  tunelo/tunelo relay --domain yourdomain.com --ws-tunnel-addr 0.0.0.0:4434
```

或使用 docker-compose：

```bash
docker compose up -d
```

## 项目结构

```
crates/
  protocol/     共享协议类型 + 编解码器
  relay/        中继服务器（库）
  tunelo/       主二进制文件（客户端 + 中继子命令）
web/            文件浏览器前端（嵌入到二进制文件中）
website/        着陆页（tunelo.net）
deploy/         VPS 部署脚本 + 配置
skills/         AI 代理技能（SKILL.md）
```

## 性能

| 指标 | 数值 |
|------|------|
| 中继内存 | 8 MB RSS |
| 隧道开销 | 相比直连约 ~14% |
| 吞吐量 | ~670 请求/秒（本地） |
| 二进制大小 | ~4 MB |

## 许可证

MIT
