# ContentMaxima skill setup — Windows (PowerShell)
# Run from the contentmaxima-cursor skill root: .\setup.ps1

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot
$env:CONTENT_MAXIMA_SKILL_ROOT = $ROOT

Write-Host "ContentMaxima skill root: $ROOT"

$missing = @()
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    $missing += "bun — install from https://bun.sh (irm bun.sh/install.ps1 | iex)"
}

if ($missing.Count -gt 0) {
    Write-Host "Missing system dependencies:"
    $missing | ForEach-Object { Write-Host "  - $_" }
    exit 1
}

Write-Host "Installing npm dependencies..."
Set-Location $ROOT
bun install

Write-Host "Installing Playwright Chromium..."
bunx playwright install chromium

$envFile = Join-Path $ROOT ".env"
$envExample = Join-Path $ROOT ".env.example"
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item $envExample $envFile
    Write-Host "Created .env from .env.example — add CONTENT_MAXIMA_EMAIL / CONTENT_MAXIMA_PASSWORD and/or OPENAI_API_KEY"
}

Write-Host ""
Write-Host "Setup complete."
Write-Host ""
Write-Host "Install as Cursor skill (copy — no admin):"
Write-Host "  New-Item -ItemType Directory -Force -Path `"$env:USERPROFILE\.cursor\skills`""
Write-Host "  Copy-Item -Recurse `"$ROOT`" `"$env:USERPROFILE\.cursor\skills\contentmaxima`""
Write-Host ""
Write-Host "Add credentials to: $env:USERPROFILE\.env"
Write-Host "  CONTENT_MAXIMA_EMAIL=..."
Write-Host "  CONTENT_MAXIMA_PASSWORD=..."
Write-Host "  OPENAI_API_KEY=...   # for reverse-engineered matrix"
Write-Host ""
Write-Host "Smoke test (reverse path):"
Write-Host "  cd `"$ROOT`"; bun ReverseEngineering/test-matrix.ts"
