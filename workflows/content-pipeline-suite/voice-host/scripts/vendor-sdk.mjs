#!/usr/bin/env node
/**
 * Bundle retell-client-js-sdk into public/retell-client.js (no CDN).
 * Pin: package.json dependencies.retell-client-js-sdk.
 */
import { build } from "esbuild";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

await build({
  absWorkingDir: root,
  stdin: {
    contents: `import { RetellClient, RetellWebClient } from "retell-client-js-sdk";
globalThis.RetellClient = RetellClient;
globalThis.RetellWebClient = RetellWebClient;
`,
    resolveDir: root,
    sourcefile: "vendor-entry.js",
  },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2020"],
  outfile: path.join(root, "public", "retell-client.js"),
  legalComments: "none",
  banner: {
    js: "/* vendored retell-client-js-sdk@3.0.1 — regenerate with npm run vendor-sdk */",
  },
  logLevel: "info",
});
