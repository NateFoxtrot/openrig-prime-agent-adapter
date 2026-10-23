#!/usr/bin/env bash
set -euo pipefail
DIST="$(npm root -g)/@openrig/cli/daemon/dist"
[ -f "$DIST/startup.js.orig" ] || { echo "no backup found; nothing to uninstall"; exit 0; }
cp "$DIST/startup.js.orig" "$DIST/startup.js"
rm -f "$DIST/adapters/prime-agent-adapter.js" "$DIST/adapters/prime-agent-adapter.d.ts"
echo "restored pristine startup.js and removed adapter. Restart rigs."
