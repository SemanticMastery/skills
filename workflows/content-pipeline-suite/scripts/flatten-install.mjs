/**
 * Copy suite skills/<name>/ to <host-skills-root>/<name>/.
 * Folder name must equal SKILL.md name:. Versioned folder names are rejected.
 *
 * Usage (from the suite folder): node scripts/flatten-install.mjs
 * HOST_SKILLS_ROOT, when set, is the only destination.
 * Otherwise the user Cursor skills folder and the Claude sibling are both used.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const VERSIONED = /-v\d/;

function declaredName(text) {
  const match = text.match(/^name:\s*["']?([^"'\n]+)["']?\s*$/m);
  return match ? match[1].trim() : "";
}

function rmTree(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function copyTree(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, ent.name);
    const to = path.join(dest, ent.name);
    if (ent.isDirectory()) copyTree(from, to);
    else fs.copyFileSync(from, to);
  }
}

export function defaultHostRoots(env = process.env, home = os.homedir()) {
  if (typeof env.HOST_SKILLS_ROOT === "string" && env.HOST_SKILLS_ROOT.trim()) {
    return [env.HOST_SKILLS_ROOT];
  }
  return [
    path.join(home, ".cursor", "skills"),
    path.join(home, ".claude", "skills"),
  ];
}

export function flattenInstall({ suiteDir, hostRoot }) {
  const skillsDir = path.join(suiteDir, "skills");
  const names = fs.readdirSync(skillsDir);
  for (const name of names) {
    if (VERSIONED.test(name)) {
      throw new Error(`versioned folder name rejected: ${name}`);
    }
  }
  for (const name of names) {
    const src = path.join(skillsDir, name);
    if (!fs.statSync(src).isDirectory()) continue;
    const skillFile = path.join(src, "SKILL.md");
    if (!fs.existsSync(skillFile)) continue;
    const declared = declaredName(fs.readFileSync(skillFile, "utf8"));
    if (declared !== name) {
      throw new Error(`${name} SKILL.md name: is "${declared || "missing"}"`);
    }
    const dest = path.join(hostRoot, name);
    rmTree(dest);
    copyTree(src, dest);
  }
}

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const suiteDir = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(here, "..");
  const roots = defaultHostRoots();
  for (const hostRoot of roots) {
    fs.mkdirSync(hostRoot, { recursive: true });
    flattenInstall({ suiteDir, hostRoot });
    console.log(`flattened into ${hostRoot}`);
  }
}

const entry = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entry && entry === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    main();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
