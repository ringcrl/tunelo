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
