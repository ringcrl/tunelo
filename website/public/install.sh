#!/bin/sh
# Tunneleo installer — curl -fsSL https://agent-tunnel.woa.com/install.sh | sh
set -eu

REPO="jiweiyuan/tunneleo"
BINARY="tunneleo"
INSTALL_DIR="/usr/local/bin"

# ── Detect platform ────────────────────────────────────────────
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)          os="linux" ;;
  Darwin)         os="macos" ;;
  MINGW*|MSYS*|CYGWIN*)  os="windows" ;;
  *)              echo "Error: unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
  x86_64|amd64)   arch="amd64" ;;
  aarch64|arm64)   arch="arm64" ;;
  *)               echo "Error: unsupported architecture: $ARCH"; exit 1 ;;
esac

PLATFORM="${os}-${arch}"

# Windows only provides amd64 for now
if [ "$os" = "windows" ] && [ "$arch" != "amd64" ]; then
  echo "Error: Windows builds are only available for amd64 (x86_64)"
  exit 1
fi

# ── Get latest version ─────────────────────────────────────────
echo "→ Detecting latest version..."
VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep '"tag_name"' | head -1 | sed 's/.*"tag_name": *"//;s/".*//')

if [ -z "$VERSION" ]; then
  echo "Error: could not detect latest version. Check https://github.com/${REPO}/releases"
  exit 1
fi

echo "→ Installing tunneleo ${VERSION} (${PLATFORM})..."

# ── Download ───────────────────────────────────────────────────
if [ "$os" = "windows" ]; then
  FILENAME="tunneleo-${PLATFORM}.exe"
else
  FILENAME="tunneleo-${PLATFORM}"
fi

URL="https://github.com/${REPO}/releases/download/${VERSION}/${FILENAME}"
TMPFILE=$(mktemp)
trap 'rm -f "$TMPFILE"' EXIT

curl -fsSL "$URL" -o "$TMPFILE"

# ── Install ────────────────────────────────────────────────────
if [ "$os" = "windows" ]; then
  # Install to user's local bin on Windows (Git Bash / MSYS2)
  WIN_INSTALL_DIR="$HOME/bin"
  mkdir -p "$WIN_INSTALL_DIR"
  mv "$TMPFILE" "${WIN_INSTALL_DIR}/${BINARY}.exe"
  echo ""
  echo "  ✔ tunneleo ${VERSION} installed to ${WIN_INSTALL_DIR}/${BINARY}.exe"
  echo ""
  echo "  Make sure ${WIN_INSTALL_DIR} is in your PATH."
  echo "  Or use PowerShell to install system-wide (see below)."
  echo ""
else
  chmod +x "$TMPFILE"
  if [ -w "$INSTALL_DIR" ]; then
    mv "$TMPFILE" "${INSTALL_DIR}/${BINARY}"
  else
    echo "→ Need sudo to install to ${INSTALL_DIR}"
    sudo mv "$TMPFILE" "${INSTALL_DIR}/${BINARY}"
  fi
  echo ""
  echo "  ✔ tunneleo ${VERSION} installed to ${INSTALL_DIR}/${BINARY}"
  echo ""
fi

echo "  Get started:"
echo "    tunneleo port 3000        expose a local service"
echo "    tunneleo serve .          share files"
echo "    tunneleo --help           see all commands"
echo ""
