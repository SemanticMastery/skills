$ErrorActionPreference = "Stop"
$Suite = Split-Path $PSScriptRoot -Parent
& node (Join-Path $PSScriptRoot "flatten-install.mjs") $Suite
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
