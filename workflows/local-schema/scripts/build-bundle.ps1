# Build distributable zip (excludes .git, node_modules, dist/*.zip)
# Usage: pwsh -File scripts/build-bundle.ps1

$ErrorActionPreference = "Stop"
$BundleRoot = Split-Path $PSScriptRoot -Parent
$date = Get-Date -Format "yyyyMMdd"
$zipName = "local-schema-$date.zip"
$outDir = Join-Path $BundleRoot "dist"
$zipPath = Join-Path $outDir $zipName

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$staging = Join-Path $env:TEMP "sl-schema-bundle-$date"
if (Test-Path $staging) { Remove-Item -Recurse -Force $staging }
New-Item -ItemType Directory -Force -Path $staging | Out-Null

# .authoring = private planning notes / student workbooks — never ship
$excludeDirs = @(".git", "node_modules", "dist", ".authoring")
Get-ChildItem -Path $BundleRoot -Force | Where-Object {
  $_.Name -notin $excludeDirs
} | ForEach-Object {
  Copy-Item -Recurse -Force $_.FullName (Join-Path $staging $_.Name)
}

if (Test-Path $zipPath) { Remove-Item -Force $zipPath }
Compress-Archive -Path (Join-Path $staging "*") -DestinationPath $zipPath -Force
Remove-Item -Recurse -Force $staging

$sizeMb = [math]::Round((Get-Item $zipPath).Length / 1MB, 2)
Write-Host "Created $zipPath ($sizeMb MB)"
