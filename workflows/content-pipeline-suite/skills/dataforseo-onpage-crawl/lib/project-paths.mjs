import fs from 'fs';
import path from 'path';

const SKILL = 'dataforseo-onpage-crawl';
const DOSSIER_SKILL = 'business-dossier';

export function resolveCrawlOutputDir(projectDir, { create = false } = {}) {
  const outputDir = path.join(path.resolve(projectDir), 'outputs', SKILL);
  if (create) fs.mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

export function findFieldLearningsFile(projectDir, { outputDir = null } = {}) {
  const candidates = [];
  if (outputDir != null) candidates.push(path.join(path.resolve(outputDir), 'field-learnings.md'));
  const resolved = path.resolve(projectDir);
  candidates.push(path.join(resolved, 'outputs', SKILL, 'field-learnings.md'));
  candidates.push(path.join(resolved, 'field-learnings.md'));
  for (const p of candidates) if (fs.existsSync(p)) return p;
  return null;
}

function listDossierMd(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((n) => /dossier\.md$/i.test(n) && !n.startsWith('~$'))
    .map((n) => path.join(dir, n));
}

export function findDossierFiles(projectDir) {
  const resolved = path.resolve(projectDir);
  const dirs = [
    path.join(resolved, 'outputs', DOSSIER_SKILL),
    resolved,
  ];
  for (const d of dirs) {
    const hits = listDossierMd(d);
    if (hits.length) return hits.sort();
  }
  return [];
}

function extractWebsite(text) {
  const patterns = [
    /\*\*Official Website:\*\*\s*(.+)$/im,
    /\*\*Website:\*\*\s*(.+)$/im,
    /(?:Official\s+)?Website:\s*(\[([^\]]*)\]\(([^)]+)\)|https?:\/\/\S+)/im,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    let val = (m[3] || m[1] || '').trim();
    const link = val.match(/\[([^\]]*)\]\(([^)]+)\)/);
    if (link) val = (link[2] || link[1]).trim();
    val = val.replace(/[.,;)\]]+$/, '');
    if (/^https?:\/\//i.test(val)) return val;
  }
  return null;
}

export function readDossierWebsite(projectDir) {
  for (const dossierPath of findDossierFiles(projectDir)) {
    const website = extractWebsite(fs.readFileSync(dossierPath, 'utf8'));
    if (website) return website;
  }
  return null;
}

export function assertDossierForCrawl(projectDir) {
  const resolved = path.resolve(projectDir);
  if (!fs.existsSync(resolved)) throw new Error(`Project dir not found: ${resolved}`);
  const files = findDossierFiles(projectDir);
  if (!files.length) {
    throw new Error(
      `No *Dossier.md found under ${resolved}/outputs/business-dossier or project root. ` +
        `Run business-dossier first, or omit --project-dir and pass --domain.`
    );
  }
  const website = readDossierWebsite(projectDir);
  if (!website) {
    throw new Error(`Dossier at ${files[0]} has no Website URL. Fix dossier or pass --domain.`);
  }
  return { dossierPath: files[0], website };
}
