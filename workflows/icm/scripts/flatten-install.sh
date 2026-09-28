#!/bin/sh
set -e
SUITE=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
node "$(CDPATH= cd -- "$(dirname "$0")" && pwd)/flatten-install.mjs" "$SUITE"
