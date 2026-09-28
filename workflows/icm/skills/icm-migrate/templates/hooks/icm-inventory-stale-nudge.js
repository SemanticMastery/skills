#!/usr/bin/env node
/**
 * ICM migrate — stop nudge when top-level inventory may be stale (fail open).
 * Compares live top-level listing hash to .cursor/icm-inventory.sha256.
 * Never edits CONTEXT.md or project-rules.
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

function listTopLevel(root) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return "";
  }
  const names = entries
    .filter((e) => !SKIP.has(e.name) && !e.name.startsWith("."))
    .map((e) => (e.isDirectory() ? e.name + "/" : e.name))
    .sort((a, b) => a.localeCompare(b));
  return names.join("\n");
}

function hashListing(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function main() {
  try {
    const root = process.cwd();
    const contextPath = path.join(root, "CONTEXT.md");
    const hashPath = path.join(root, ".cursor", "icm-inventory.sha256");
    if (!fs.existsSync(contextPath) || !fs.existsSync(hashPath)) {
      process.exit(0);
    }
    const expected = fs.readFileSync(hashPath, "utf8").trim().split(/\s+/)[0];
    if (!expected) process.exit(0);
    const actual = hashListing(listTopLevel(root));
    if (actual !== expected) {
      console.log(
        "[icm-migrate] Top-level children may have changed. Inventory markers may be stale — run /icm-refresh-context (updates <!-- ICM:INVENTORY --> only; does not edit project-rules)."
      );
    }
  } catch {
    // fail open
  }
  process.exit(0);
}

main();
