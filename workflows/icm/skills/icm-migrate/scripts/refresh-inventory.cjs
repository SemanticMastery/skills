#!/usr/bin/env node
/**
 * Refresh only <!-- ICM:INVENTORY --> ... <!-- /ICM:INVENTORY --> in CONTEXT.md.
 * Also writes .cursor/icm-inventory.sha256. Never touches project-rules.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const START = "<!-- ICM:INVENTORY -->";
const END = "<!-- /ICM:INVENTORY -->";
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
  const out = { root: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--root") out.root = argv[++i];
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--help" || a === "-h") out.help = true;
  }
  return out;
}

function listTopLevel(root) {
  const entries = fs.readdirSync(root, { withFileTypes: true });
  return entries
    .filter((e) => !SKIP.has(e.name) && !e.name.startsWith("."))
    .map((e) => ({
      name: e.name,
      type: e.isDirectory() ? "dir" : "file",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function listingText(items) {
  return items
    .map((i) => (i.type === "dir" ? i.name + "/" : i.name))
    .join("\n");
}

function hashListing(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function buildTable(items) {
  const updated = new Date().toISOString().slice(0, 10);
  const rows = items.map((i) => {
    const p = i.type === "dir" ? `\`${i.name}/\`` : `\`${i.name}\``;
    return `| ${p} | ${i.type} | |`;
  });
  return [
    `| Path | Type | Notes |`,
    `|------|------|-------|`,
    ...rows,
    ``,
    `_Updated: ${updated}_`,
  ].join("\n");
}

function replaceInventory(content, table) {
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(
      "CONTEXT.md missing <!-- ICM:INVENTORY --> / <!-- /ICM:INVENTORY --> markers"
    );
  }
  const before = content.slice(0, startIdx + START.length);
  const after = content.slice(endIdx);
  return `${before}\n${table}\n${after}`;
}

function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.root) {
    console.log(
      "Usage: node refresh-inventory.cjs --root <absolute-path> [--dry-run]"
    );
    process.exit(args.help ? 0 : 1);
  }
  const root = path.resolve(args.root);
  const contextPath = path.join(root, "CONTEXT.md");
  if (!fs.existsSync(contextPath)) {
    console.error("ERROR: CONTEXT.md not found at", contextPath);
    process.exit(1);
  }
  const items = listTopLevel(root);
  const table = buildTable(items);
  const text = listingText(items);
  const sha = hashListing(text);
  const prev = fs.readFileSync(contextPath, "utf8");
  const next = replaceInventory(prev, table);

  if (args.dryRun) {
    console.log("DRY RUN — would update inventory markers + hash");
    console.log("hash:", sha);
    console.log("items:", items.length);
    process.exit(0);
  }

  if (next !== prev) {
    fs.writeFileSync(contextPath, next, "utf8");
    console.log("Updated CONTEXT.md inventory markers");
  } else {
    console.log("CONTEXT.md inventory unchanged");
  }

  const cursorDir = path.join(root, ".cursor");
  fs.mkdirSync(cursorDir, { recursive: true });
  const hashPath = path.join(cursorDir, "icm-inventory.sha256");
  fs.writeFileSync(hashPath, sha + "\n", "utf8");
  console.log("Wrote", hashPath);
  console.log("items:", items.length, "hash:", sha.slice(0, 12) + "…");
}

main();
