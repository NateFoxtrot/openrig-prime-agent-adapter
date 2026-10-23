#!/usr/bin/env node
// Idempotently patch @openrig/cli startup.js to register the prime-agent runtime adapter.
import fs from "node:fs";
import path from "node:path";

const dist = process.argv[2];
if (!dist) { console.error("usage: patch-startup.mjs <dist-dir>"); process.exit(1); }
const file = path.join(dist, "startup.js");
let src = fs.readFileSync(file, "utf8");
let changed = 0;

const IMPORT = `    const { PrimeAgentAdapter } = await import("./adapters/prime-agent-adapter.js");\n`;
if (!src.includes("prime-agent-adapter.js")) {
    const anchor = `    const startupOrchestrator = new StartupOrchestrator({`;
    if (!src.includes(anchor)) { console.error("anchor missing: startupOrchestrator"); process.exit(1); }
    src = src.replace(anchor, IMPORT + anchor); changed++;
}

const CONSTRUCT = `    const primeAgentAdapter = new PrimeAgentAdapter({ tmux: tmuxAdapter, fsOps: { readFile: (p) => fs.readFileSync(p, "utf-8"), exists: (p) => fs.existsSync(p), mkdirp: (p) => fs.mkdirSync(p, { recursive: true }), copyFile: (s, d) => fs.copyFileSync(s, d), readdir: (d) => fs.readdirSync(d) } });\n`;
if (!src.includes("const primeAgentAdapter")) {
    const anchor = `    const startupOrchestrator = new StartupOrchestrator({`;
    src = src.replace(anchor, CONSTRUCT + anchor); changed++;
}

for (const map of ['adapters: { "claude-code"', 'runtimeAdapters: { "claude-code"']) {
    const needle = `"omp": ompAdapter, "stub"`;
    const repl = `"omp": ompAdapter, "prime-agent": primeAgentAdapter, "stub"`;
    const idx = src.indexOf(map);
    if (idx === -1) { console.error("anchor missing: " + map); process.exit(1); }
    const seg = src.slice(idx, idx + 400);
    if (!seg.includes(`"prime-agent": primeAgentAdapter`)) {
        src = src.slice(0, idx) + seg.replace(needle, repl) + src.slice(idx + 400); changed++;
    }
}

fs.writeFileSync(file, src);
console.log(changed === 0 ? "already patched" : `patched (${changed} edits)`);
