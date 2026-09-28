#!/usr/bin/env node
/**
 * Compute (and optionally write) top-level inventory hash for stale detection.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SKIP = new Set([
  ".git",
  ".cursor",
  "node_modules",
  ".venv",
  "__pycache__",
  "Thumbs.db",
  ".DS_Store",
]);

function parseArgs(argv) {
  const out = { root: null, write: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") out.root = argv[++i];
    else if (a === "--write") out.write = true;
  }
  return out;
}

function listTopLevel(root) {
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((e) => !SKIP.has(e.name) && !e.name.startsWith("."))
    .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
    .sort((a, b) => a.localeCompare(b))
    .join("\n");
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.root) {
    console.log("Usage: node inventory-hash.cjs --root <absolute-path> [--write]");
    process.exit(1);
  }
  const root = path.resolve(args.root);
  const sha = crypto
    .createHash("sha256")
    .update(listTopLevel(root), "utf8")
    .digest("hex");
  console.log(sha);
  if (args.write) {
    const dir = path.join(root, ".cursor");
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "icm-inventory.sha256"), sha + "\n", "utf8");
    console.error("Wrote .cursor/icm-inventory.sha256");
  }
}

main();
