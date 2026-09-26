import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SKILL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function skillRoot(): string {
  return process.env.CONTENT_MAXIMA_SKILL_ROOT || SKILL_ROOT;
}

export function envFileCandidates(): string[] {
  const home = process.env.HOME || process.env.USERPROFILE || "";
  return [
    join(skillRoot(), ".env"),
    join(home, ".env"),
    join(home, ".contentmaxima", ".env"),
    join(home, ".cursor", "skills", "contentmaxima", ".env"),
  ];
}

export function isPlaceholderSecret(value: string | undefined): boolean {
  if (!value) return true;
  return /you@example\.com|your_password_here|changeme|^TODO$|^xxx+$|^<.*>$/i.test(
    value.trim()
  );
}

export async function loadEnvFiles(): Promise<void> {
  for (const envPath of envFileCandidates()) {
    if (!existsSync(envPath)) continue;
    try {
      const envContent = await readFile(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.slice(0, eqIndex).trim();
        let value = trimmed.slice(eqIndex + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (!process.env[key] && !isPlaceholderSecret(value)) {
          process.env[key] = value;
        }
      }
    } catch {
      // Try next candidate.
    }
  }
}

export async function resolveSecret(name: string): Promise<string | undefined> {
  await loadEnvFiles();
  return process.env[name];
}
