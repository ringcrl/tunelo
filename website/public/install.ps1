# Tunneleo installer for Windows (PowerShell)
# Usage: irm https://agent-tunnel.woa.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

$repo = "jiweiyuan/tunneleo"
$binary = "tunneleo.exe"

# ── Detect architecture ─────────────────────────────────────────
$arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else {
    Write-Error "Error: 32-bit Windows is not supported."
    exit 1
}

$platform = "windows-$arch"

# ── Get latest version ──────────────────────────────────────────
Write-Host "→ Detecting latest version..."
$release = Invoke-RestMethod -Uri "https://api.github.com/repos/$repo/releases/latest"
$version = $release.tag_name

if (-not $version) {
    Write-Error "Error: could not detect latest version. Check https://github.com/$repo/releases"
    exit 1
}

Write-Host "→ Installing tunneleo $version ($platform)..."

# ── Download ────────────────────────────────────────────────────
$filename = "tunneleo-${platform}.exe"
$url = "https://github.com/$repo/releases/download/$version/$filename"
$installDir = "$env:LOCALAPPDATA\tunneleo"
$installPath = Join-Path $installDir $binary

New-Item -ItemType Directory -Force -Path $installDir | Out-Null

Write-Host "→ Downloading from $url..."
Invoke-WebRequest -Uri $url -OutFile $installPath -UseBasicParsing

# ── Add to PATH ─────────────────────────────────────────────────
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installDir*") {
    Write-Host "→ Adding $installDir to user PATH..."
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installDir", "User")
    $env:Path = "$env:Path;$installDir"
}

Write-Host ""
Write-Host "  ✔ tunneleo $version installed to $installPath" -ForegroundColor Green
Write-Host ""
Write-Host "  Get started:"
Write-Host "    tunneleo port 3000        expose a local service"
Write-Host "    tunneleo serve .          share files"
Write-Host "    tunneleo --help           see all commands"
Write-Host ""
Write-Host "  Note: restart your terminal for PATH changes to take effect."
Write-Host ""
