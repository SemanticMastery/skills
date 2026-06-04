#!/usr/bin/env node
/**
 * Glen Patel Business Dossier Composer
 *
 * Pre-gather: SerpAPI (GBP + place details) + Firecrawl (website, reviews, owner, BBB, registry)
 * Synthesis: xAI Grok (default grok-4.3) with live search
 * Output: Markdown + Box Tree Care-style DOCX at client project folder root
 *
 * Env:
 *   GROK_API_KEY (required)
 *   SERPAPI_API_KEY (pre-gather — strongly recommended)
 *   FIRECRAWL_API_KEY (pre-gather — via firecrawl CLI auth)
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeMarkdownDossierDocx } from './lib/markdown-dossier-docx.mjs';
import {
  pregatherDossier,
  buildPregatherUserAppendix,
} from './lib/pregather-dossier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PROMPT = path.resolve(
  __dirname,
  '..',
  '..',
  'skills',
  'business-dossier',
  'prompts',
  'glen-patel-system.md'
);
const XAI_URL = 'https://api.x.ai/v1/responses';
const DEFAULT_MODEL = 'grok-4.3';
const REQUIRED_SECTIONS = [
  '[I] EXECUTIVE SUMMARY',
  '[II] FIRMOGRAPHICS',
  '[III] SCOPE OF OPERATIONS',
  '[IV] LEADERSHIP & CREDENTIALS',
  '[V] DIGITAL ECOSYSTEM',
  '[VI] PUBLIC SENTIMENT ANALYSIS',
  '[VII] BUSINESS DESCRIPTION',
];

function parseArgs(argv) {
  const out = {
    name: null,
    address: null,
    phone: null,
    website: null,
    gbpUrl: null,
    projectDir: null,
    model: DEFAULT_MODEL,
    dryRun: false,
    skipPregather: false,
    skipFirecrawl: false,
    keepArtifacts: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--name' && argv[i + 1]) out.name = argv[++i];
    else if (a === '--address' && argv[i + 1]) out.address = argv[++i];
    else if (a === '--phone' && argv[i + 1]) out.phone = argv[++i];
    else if (a === '--website' && argv[i + 1]) out.website = argv[++i];
    else if (a === '--gbp-url' && argv[i + 1]) out.gbpUrl = argv[++i];
    else if (a === '--project-dir' && argv[i + 1]) out.projectDir = argv[++i];
    else if (a === '--model' && argv[i + 1]) out.model = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-pregather') out.skipPregather = true;
    else if (a === '--skip-firecrawl') out.skipFirecrawl = true;
    else if (a === '--keep-artifacts') out.keepArtifacts = true;
    else if (a === '--skip-gbp-enrichment') out.skipPregather = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }

  return out;
}

function usage() {
  return `Usage:
  node compose-business-dossier.mjs \\
    --name "Business Name" \\
    --address "123 Main St, City, ST 12345" \\
    --phone "(555) 555-5555" \\
    --website "https://example.com" \\
    --gbp-url "https://maps.app.goo.gl/..." \\
    --project-dir "C:\\\\path\\\\to\\\\client\\\\project"

Options:
  --name TEXT              Company / DBA name (required)
  --address TEXT           Primary street address (required)
  --phone TEXT             Primary phone (required)
  --website TEXT           Official website URL (required)
  --gbp-url URL            Google Maps / GBP share URL (required)
  --project-dir PATH       Client project folder for deliverables (required)
  --model TEXT             xAI model slug (default: ${DEFAULT_MODEL})
  --skip-pregather         Skip SerpAPI + Firecrawl pre-gather (Grok only)
  --skip-firecrawl         Skip Firecrawl steps; keep SerpAPI pre-gather
  --keep-artifacts         Keep temp pre-gather scratch dir (debug only)
  --dry-run                Validate inputs + show paths; no API calls
  --help

Pre-gather scratch (temp — deleted after success unless --keep-artifacts):
  {tmpdir}/business-dossier-{slug}-{timestamp}/

Output (project folder root — only deliverables):
  {Business Name} Dossier.md
  {Business Name} Dossier.docx`;
}

function grokApiKey() {
  const key = process.env.GROK_API_KEY;
  if (!key) {
    throw new Error(
      'Missing GROK_API_KEY in environment. Set Windows User env and restart Cursor.'
    );
  }
  return key;
}

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/['']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function dossierBasename(name) {
  return `${name.trim()} Dossier`;
}

function createWorkDir(slug) {
  const dir = path.join(os.tmpdir(), `business-dossier-${slug}-${Date.now()}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupWorkDir(workDir, keepArtifacts, log) {
  if (!workDir || keepArtifacts) {
    if (keepArtifacts && workDir) log.push(`Kept scratch dir: ${workDir}`);
    return;
  }
  try {
    fs.rmSync(workDir, { recursive: true, force: true });
    log.push(`Removed scratch dir: ${workDir}`);
  } catch (err) {
    log.push(`WARNING: could not remove scratch dir (${workDir}): ${err.message}`);
  }
}

function loadSystemPrompt() {
  if (!fs.existsSync(SKILL_PROMPT)) {
    throw new Error(`System prompt not found: ${SKILL_PROMPT}`);
  }
  return fs.readFileSync(SKILL_PROMPT, 'utf8').trim();
}

function buildUserMessage(args, pregatherBundle) {
  const lines = [
    'Conduct the full TSCR dossier for this subject business.',
    '',
    '## Provided NAPW + GBP',
    `- **Company name:** ${args.name}`,
    `- **Address:** ${args.address}`,
    `- **Phone:** ${args.phone}`,
    `- **Website:** ${args.website}`,
    `- **GB Map share URL:** ${args.gbpUrl}`,
    '',
    'Use live search AND the pre-gather bundle below to verify every node.',
    'Cross-reference at least two independent sources where possible.',
    'Flag discrepancies. Do not fabricate missing data — state where you searched.',
  ];

  if (pregatherBundle) {
    lines.push(buildPregatherUserAppendix(pregatherBundle));
  } else {
    lines.push(
      '',
      'Return ONLY the dossier report with the seven required section headers ([I] through [VII]). No preamble or closing commentary.'
    );
  }

  return lines.join('\n');
}

function validateSections(text) {
  const missing = REQUIRED_SECTIONS.filter((h) => !text.includes(h));
  return { ok: missing.length === 0, missing };
}

function extractResponsesText(parsed) {
  if (typeof parsed?.output_text === 'string' && parsed.output_text.trim()) {
    return parsed.output_text.trim();
  }

  const chunks = [];
  for (const item of parsed?.output || []) {
    if (typeof item?.content === 'string' && item.content.trim()) {
      chunks.push(item.content.trim());
      continue;
    }
    for (const part of item?.content || []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }

  return chunks.join('\n\n').trim();
}

async function callGrok({ model, systemPrompt, userMessage, log }) {
  const key = grokApiKey();
  const body = {
    model,
    input: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.2,
    store: false,
    tools: [{ type: 'web_search' }, { type: 'x_search' }],
  };

  log.push(`POST ${XAI_URL} model=${model} tools=web_search,x_search`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600_000);

  let response;
  try {
    response = await fetch(XAI_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  const raw = await response.text();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`xAI returned non-JSON (${response.status}): ${raw.slice(0, 500)}`);
  }

  if (!response.ok) {
    throw new Error(
      `xAI error ${response.status}: ${parsed?.error?.message || raw.slice(0, 500)}`
    );
  }

  const content = extractResponsesText(parsed);
  if (!content) {
    throw new Error('xAI response missing output text');
  }

  log.push(`xAI responses ok; usage=${JSON.stringify(parsed.usage || {})}`);
  return { content, raw: parsed };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  const required = ['name', 'address', 'phone', 'website', 'gbpUrl', 'projectDir'];
  const missingArgs = required.filter((k) => !args[k]);
  if (missingArgs.length) {
    console.error(JSON.stringify({ error: 'Missing required arguments', missing: missingArgs }, null, 2));
    console.error(usage());
    process.exit(1);
  }

  const projectDir = path.resolve(args.projectDir);
  fs.mkdirSync(projectDir, { recursive: true });

  const slug = slugify(args.name);
  const baseName = dossierBasename(args.name);
  const mdPath = path.join(projectDir, `${baseName}.md`);
  const docxPath = path.join(projectDir, `${baseName}.docx`);
  const log = [];
  let workDir = null;

  if (args.dryRun) {
    const summary = {
      dry_run: true,
      inputs: {
        name: args.name,
        address: args.address,
        phone: args.phone,
        website: args.website,
        gbp_url: args.gbpUrl,
        project_dir: projectDir,
        model: args.model,
        skip_pregather: args.skipPregather,
        skip_firecrawl: args.skipFirecrawl,
        keep_artifacts: args.keepArtifacts,
      },
      outputs: { md: mdPath, docx: docxPath },
      scratch_dir_pattern: path.join(os.tmpdir(), `business-dossier-${slug}-{timestamp}`),
      grok_api_key_present: Boolean(process.env.GROK_API_KEY),
      serpapi_key_present: Boolean(process.env.SERPAPI_API_KEY),
      firecrawl_cli: 'run firecrawl --status to verify',
    };
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const systemPrompt = loadSystemPrompt();
  let pregatherBundle = null;

  if (!args.skipPregather) {
    workDir = createWorkDir(slug);
    log.push(`Scratch dir: ${workDir}`);
    log.push('Starting pre-gather (SerpAPI + Firecrawl)...');
    pregatherBundle = await pregatherDossier({
      name: args.name,
      address: args.address,
      phone: args.phone,
      website: args.website,
      gbpUrl: args.gbpUrl,
      workDir,
      slug,
      log,
      skipFirecrawl: args.skipFirecrawl,
    });
  } else {
    log.push('Pre-gather skipped (--skip-pregather).');
  }

  try {
    const userMessage = buildUserMessage(args, pregatherBundle);
    const { content, raw } = await callGrok({
      model: args.model,
      systemPrompt,
      userMessage,
      log,
    });

    const validation = validateSections(content);
    if (!validation.ok) {
      log.push(`WARNING: missing sections: ${validation.missing.join(', ')}`);
    }

    fs.writeFileSync(mdPath, content + '\n', 'utf8');
    writeMarkdownDossierDocx({
      markdown: content,
      outputPath: docxPath,
      header: pregatherBundle?.docx_header || { businessName: args.name },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          business_name: args.name,
          markdown: mdPath,
          docx: docxPath,
          section_validation: validation,
          model: args.model,
          xai_usage: raw.usage || null,
          warnings: log.filter((line) => line.startsWith('WARNING:')),
        },
        null,
        2
      )
    );

    cleanupWorkDir(workDir, args.keepArtifacts, log);

    if (!validation.ok) {
      process.exit(2);
    }
  } catch (err) {
    if (workDir && !args.keepArtifacts) {
      log.push(`Preserving scratch dir after error: ${workDir}`);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(JSON.stringify({ error: err.message }, null, 2));
  process.exit(1);
});
