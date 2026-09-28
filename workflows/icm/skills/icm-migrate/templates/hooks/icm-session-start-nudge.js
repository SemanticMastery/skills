#!/usr/bin/env node
/**
 * ICM migrate — sessionStart nudge (fail open).
 * Soft-remind to read CONTEXT.md. Never edits files.
 */
const fs = require("fs");
const path = require("path");

function main() {
  try {
    const root = process.cwd();
    const contextPath = path.join(root, "CONTEXT.md");
    if (!fs.existsSync(contextPath)) {
      process.exit(0);
    }
    const msg =
      "[icm-migrate] CONTEXT.md present. Read CONTEXT.md first; pin active path before substantive edits. Soft boundary only.";
    // Cursor command hooks: print to stdout for agent-visible follow-up
    console.log(msg);
  } catch {
    // fail open
  }
  process.exit(0);
}

main();
