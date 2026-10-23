#!/usr/bin/env bash
set -euo pipefail
ROOT="$(npm root -g)"
DIST="$ROOT/@openrig/cli/daemon/dist"
[ -d "$DIST" ] || { echo "ERROR: @openrig/cli dist not found at $DIST"; exit 1; }
echo "dist: $DIST"
mkdir -p "$DIST/adapters"
[ -f "$DIST/startup.js.orig" ] || cp "$DIST/startup.js" "$DIST/startup.js.orig"
cp adapters/prime-agent-adapter.js adapters/prime-agent-adapter.d.ts "$DIST/adapters/"
node scripts/patch-startup.mjs "$DIST"
node --check "$DIST/startup.js" && echo "startup.js syntax OK"
echo "done — restart your rigs (rig down/up) to pick up the new runtime."
