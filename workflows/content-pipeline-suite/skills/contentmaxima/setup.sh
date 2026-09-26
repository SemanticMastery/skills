#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export CONTENT_MAXIMA_SKILL_ROOT="$ROOT"

echo "ContentMaxima skill root: $CONTENT_MAXIMA_SKILL_ROOT"

missing=()
command -v bun >/dev/null 2>&1 || missing+=("bun — https://bun.sh")

if ((${#missing[@]} > 0)); then
  echo "Missing system dependencies:"
  printf '  - %s\n' "${missing[@]}"
  exit 1
fi

echo "Installing npm dependencies..."
cd "$ROOT"
bun install

echo "Installing Playwright Chromium..."
bunx playwright install chromium

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  echo "Created .env from .env.example — add CONTENT_MAXIMA_EMAIL / CONTENT_MAXIMA_PASSWORD and/or OPENAI_API_KEY"
fi

echo ""
echo "Setup complete."
echo ""
echo "Install as Cursor skill:"
echo "  mkdir -p \"$HOME/.cursor/skills\""
echo "  ln -sfn \"$ROOT\" \"$HOME/.cursor/skills/contentmaxima\""
echo ""
echo "Add to shell profile (optional):"
echo "  export CONTENT_MAXIMA_SKILL_ROOT=\"$ROOT\""
echo ""
echo "Smoke tests:"
echo "  # Official path needs Content Maxima credentials"
echo "  # bun Tools/Matrix.ts --help   # (tools print usage if keyword missing)"
echo "  # Reverse path needs OPENAI_API_KEY"
echo "  bun ReverseEngineering/test-matrix.ts"
