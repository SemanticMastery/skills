/**
 * Produce-chain artifact paths.
 *
 * Single-file stages (brief / draft / edit) stay flat in the stage folder.
 * When a post has more than one artifact — or the stage is polish/images —
 * files live in `{stage}/post-{NN}-{stage}/`.
 */
import fs from "node:fs";
import path from "node:path";

export const PRODUCE_FOLDERS = {
  brief: "03-write/3.1-brief",
  draft: "03-write/3.2-draft",
  edit: "03-write/3.3-edit",
  polish: "03-write/3.4-polish",
  images: "03-write/3.5-images",
};

/** Always nest: these stages accrue more than one file per post. */
export const BUNDLE_STAGES = new Set(["polish", "images"]);

const STAGE_FILE_RE = /^post-(\d+)-(brief|draft|edit|polish|images)(\.[^.]+)?$/i;
const IMAGE_PNG_RE = /^post-(\d+)-img-\d+\.[^.]+$/i;

export function padPost(n) {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 1) return null;
  return String(Math.trunc(num)).padStart(2, "0");
}

export function stageDir(pipelineDir, stageKey) {
  const rel = PRODUCE_FOLDERS[stageKey];
  if (!rel) return null;
  return path.join(pipelineDir, rel);
}

export function postBundleName(nn, stageKey) {
  return `post-${nn}-${stageKey}`;
}

export function primaryFilename(nn, stageKey) {
  return `post-${nn}-${stageKey}.md`;
}

export function postBundleDir(pipelineDir, stageKey, post) {
  const nn = padPost(post);
  const dir = stageDir(pipelineDir, stageKey);
  if (!nn || !dir) return null;
  return path.join(dir, postBundleName(nn, stageKey));
}

export function nestedArtifact(pipelineDir, stageKey, post) {
  const nn = padPost(post);
  const bundle = postBundleDir(pipelineDir, stageKey, post);
  if (!nn || !bundle) return null;
  return path.join(bundle, primaryFilename(nn, stageKey));
}

export function flatArtifact(pipelineDir, stageKey, post) {
  const nn = padPost(post);
  const dir = stageDir(pipelineDir, stageKey);
  if (!nn || !dir) return null;
  return path.join(dir, primaryFilename(nn, stageKey));
}

/**
 * Prefer nested if it exists, then flat. Write target is nested for bundle
 * stages and for any post that already has a bundle folder.
 */
export function resolveArtifact(pipelineDir, stageKey, post) {
  if (stageKey === "plan") {
    return path.join(pipelineDir, "02-plan", "editorial-roadmap.md");
  }
  const nested = nestedArtifact(pipelineDir, stageKey, post);
  const flat = flatArtifact(pipelineDir, stageKey, post);
  if (nested && fs.existsSync(nested)) return nested;
  if (flat && fs.existsSync(flat)) return flat;
  if (BUNDLE_STAGES.has(stageKey)) return nested;
  const bundle = postBundleDir(pipelineDir, stageKey, post);
  if (bundle && fs.existsSync(bundle)) return nested;
  return flat;
}

export function resolveArtifactDir(pipelineDir, stageKey, post) {
  const art = resolveArtifact(pipelineDir, stageKey, post);
  return art ? path.dirname(art) : null;
}

export function classifyStageFile(name) {
  const base = path.basename(name);
  let m = base.match(STAGE_FILE_RE);
  if (m) {
    return { nn: padPost(m[1]), stageKey: m[2].toLowerCase() };
  }
  m = base.match(IMAGE_PNG_RE);
  if (m) {
    return { nn: padPost(m[1]), stageKey: "images" };
  }
  return null;
}

/**
 * Move a post's stage files into `post-{NN}-{stage}/` when the stage is a
 * bundle stage or the post already has more than one artifact.
 */
export function nestPostArtifacts(stageAbsDir, stageKey, { execute = false } = {}) {
  if (!fs.existsSync(stageAbsDir)) return [];
  const groups = new Map();
  for (const name of fs.readdirSync(stageAbsDir)) {
    if (name === "CONTEXT.md" || name.startsWith("_") || name.startsWith(".")) continue;
    const abs = path.join(stageAbsDir, name);
    let st;
    try {
      st = fs.statSync(abs);
    } catch {
      continue;
    }
    if (st.isDirectory()) continue;
    const info = classifyStageFile(name);
    if (!info || info.stageKey !== stageKey) continue;
    const list = groups.get(info.nn) || [];
    list.push(name);
    groups.set(info.nn, list);
  }

  const ops = [];
  for (const [nn, names] of groups) {
    const shouldNest = BUNDLE_STAGES.has(stageKey) || names.length > 1;
    if (!shouldNest) continue;
    const destDir = path.join(stageAbsDir, postBundleName(nn, stageKey));
    for (const name of names) {
      const from = path.join(stageAbsDir, name);
      const to = path.join(destDir, name);
      ops.push({ from, to, nn, stageKey });
      if (execute) {
        fs.mkdirSync(destDir, { recursive: true });
        if (path.resolve(from) !== path.resolve(to)) {
          fs.renameSync(from, to);
        }
      }
    }
  }
  return ops;
}

export function nestCampaignArtifacts(pipelineDir, { execute = false } = {}) {
  const all = [];
  for (const stageKey of Object.keys(PRODUCE_FOLDERS)) {
    const dir = stageDir(pipelineDir, stageKey);
    all.push(...nestPostArtifacts(dir, stageKey, { execute }));
  }
  return all;
}
