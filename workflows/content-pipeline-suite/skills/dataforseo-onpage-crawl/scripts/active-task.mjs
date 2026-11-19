/**
 * Persist the in-flight OnPage task_id under the audit root so agents
 * cannot overlap --post-only for the same host (Harborview 2026-08-10).
 */
import fs from 'fs';
import path from 'path';

export const ACTIVE_TASK_FILENAME = '.dfs-active-task.json';

export function activeTaskPath(outputDir) {
  if (!outputDir) return null;
  return path.join(path.resolve(outputDir), ACTIVE_TASK_FILENAME);
}

export function hostKey(host) {
  if (!host) return '';
  return String(host)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');
}

export function readActiveTask(outputDir) {
  const p = activeTaskPath(outputDir);
  if (!p || !fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!raw?.task_id) return null;
    return raw;
  } catch {
    return null;
  }
}

export function writeActiveTask(outputDir, record) {
  const p = activeTaskPath(outputDir);
  if (!p) return null;
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const payload = {
    task_id: record.task_id,
    host: hostKey(record.host),
    user_agent: record.user_agent ?? null,
    status: record.status ?? 'in_progress',
    started_at: record.started_at ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(p, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return p;
}

export function clearActiveTask(outputDir) {
  const p = activeTaskPath(outputDir);
  if (p && fs.existsSync(p)) {
    fs.unlinkSync(p);
    return true;
  }
  return false;
}

/**
 * Append `user_agent: browser` to campaign field-learnings.md when Googlebot bot_block is confirmed.
 */
export function ensureBrowserUaLearning(projectDir, outputDir = null) {
  if (!projectDir && !outputDir) return { wrote: false, path: null };
  const dir =
    outputDir != null
      ? path.resolve(outputDir)
      : path.join(path.resolve(projectDir), '01-intake', '1.2-audit');
  fs.mkdirSync(dir, { recursive: true });
  const learningsPath = path.join(dir, 'field-learnings.md');
  let text = fs.existsSync(learningsPath) ? fs.readFileSync(learningsPath, 'utf8') : '';
  if (/user_agent:\s*browser/i.test(text)) {
    return { wrote: false, path: learningsPath };
  }
  const stamp = new Date().toISOString().slice(0, 10);
  const block =
    `${text && !text.endsWith('\n') ? '\n' : ''}` +
    `\n# Auto (dataforseo-onpage-crawl ${stamp})\n` +
    `# Confirmed Googlebot bot_block / WAF — prefer browser UA on future crawls\n` +
    `user_agent: browser\n`;
  fs.appendFileSync(learningsPath, text ? block : block.trimStart(), 'utf8');
  return { wrote: true, path: learningsPath };
}
