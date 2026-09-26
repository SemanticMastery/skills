#!/usr/bin/env node
/**
 * Glen Patel Business Dossier Composer
 *
 * Pre-gather: SerpAPI (GBP + place details) + Firecrawl (website, reviews, owner, BBB, registry)
 * Synthesis: xAI Grok (default grok-4.5) with live search
 * Output: Markdown + standard DOCX at {campaign}/outputs/business-dossier/
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
import {
  resolveDossierArtifactPaths,
  validateFirmographicsSection,
  normalizeDossierFirmographics,
  ensureGbpUrlInDossier,
  ensureCoordinatesInDossier,
} from './lib/dossier-firmographics.mjs';
import { resolveMapsCid } from './lib/resolve-maps-cid.mjs';
import { sanitizeDossierMarkdown } from './lib/sanitize-dossier-markdown.mjs';
import {
  geocodeAddress,
  applySerpGpsFallback,
  geoForOutput,
  geocodeSourceLabel,
} from './lib/geocode-address.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_PROMPT = path.resolve(__dirname, '..', 'prompts', 'system-prompt.md');
const XAI_URL = 'https://api.x.ai/v1/responses';
const DEFAULT_MODEL = 'grok-4.5';
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
    outputDir: null,
    model: DEFAULT_MODEL,
    dryRun: false,
    skipPregather: false,
    skipFirecrawl: false,
    keepArtifacts: false,
    latitude: null,
    longitude: null,
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
    else if (a === '--output-dir' && argv[i + 1]) out.outputDir = argv[++i];
    else if (a === '--model' && argv[i + 1]) out.model = argv[++i];
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--skip-pregather') out.skipPregather = true;
    else if (a === '--skip-firecrawl') out.skipFirecrawl = true;
    else if (a === '--keep-artifacts') out.keepArtifacts = true;
    else if ((a === '--latitude' || a === '--lat') && argv[i + 1]) out.latitude = argv[++i];
    else if ((a === '--longitude' || a === '--lng' || a === '--lon') && argv[i + 1]) {
      out.longitude = argv[++i];
    }
    else if (a === '--skip-gbp-enrichment') out.skipPregather = true;
    else if (a === '--help' || a === '-h') out.help = true;
  }

  return out;
}

/** xAI usage.cost_in_usd_ticks → USD (divide by 1e10, not 1e8). */
function xaiCostFromUsage(usage) {
  if (!usage || usage.cost_in_usd_ticks == null) return null;
  const usd = Number(usage.cost_in_usd_ticks) / 1e10;
  return Number.isFinite(usd) ? usd : null;
}

function usage() {
  return `Usage:
  node compose-business-dossier.mjs \\
    --name "Business Name" \\
    --address "123 Main St, City, ST 12345" \\
    --phone "(555) 555-5555" \\
    --website "https://example.com" \\
    --gbp-url "https://www.google.com/maps?cid=..." \\
    --project-dir "C:\\\\path\\\\to\\\\client\\\\project"

Options:
  --name TEXT              Company / DBA name (required)
  --address TEXT           Primary street address (required; geocoded to lat/long)
  --latitude / --lat NUM   Optional lat override (skip Nominatim)
  --longitude / --lng NUM  Optional lng override (skip Nominatim)
  --phone TEXT             Primary phone (required)
  --website TEXT           Official website URL (required)
  --gbp-url URL            Maps / GBP URL (required). Share / maps.app / place URLs are resolved to https://www.google.com/maps?cid={CID} before write. Compose stops if CID cannot be resolved.
  --project-dir PATH       Campaign folder (--project-dir); dossier writes to outputs/business-dossier/
  --output-dir PATH        Optional override for dossier output directory
  --model TEXT             xAI model slug (default: ${DEFAULT_MODEL})
  --skip-pregather         Skip SerpAPI + Firecrawl pre-gather (Grok only)
  --skip-firecrawl         Skip Firecrawl steps; keep SerpAPI pre-gather
  --keep-artifacts         Keep temp pre-gather scratch dir (debug only)
  --dry-run                Validate inputs + geocode + show paths; no Grok/pre-gather
  --help

Pre-gather scratch (temp — deleted after success unless --keep-artifacts):
  {tmpdir}/business-dossier-{slug}-{timestamp}/

Output (Golden Image — only deliverables):
  {campaign}/outputs/business-dossier/{Business-Name}-Dossier.md
  {campaign}/outputs/business-dossier/{Business-Name}-Dossier.docx`;
}

function grokApiKey() {
  const key = process.env.GROK_API_KEY;
  if (!key) {
    throw new Error(
      'Missing GROK_API_KEY in environment. Set it as a user/environment variable and restart your IDE/agent.'
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

function resolveOutputPaths(args) {
  const projectDir = path.resolve(args.projectDir);
  fs.mkdirSync(projectDir, { recursive: true });
  return resolveDossierArtifactPaths(projectDir, args.name, {
    createOutputDir: true,
    outputDir: args.outputDir,
  });
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
    args.geo?.ok
      ? `- **Latitude:** ${geoForOutput(args.geo).latitude}`
      : null,
    args.geo?.ok
      ? `- **Longitude:** ${geoForOutput(args.geo).longitude}`
      : null,
    args.geo?.ok && args.geo.display_name
      ? `- **Geocoded address:** ${args.geo.display_name}`
      : null,
    `- **Phone:** ${args.phone}`,
    `- **Website:** ${args.website}`,
    `- **GBP / Maps URL (canonical CID):** ${args.gbpUrl}`,
    '',
    'Use live search AND the pre-gather bundle below to verify every node.',
    'Cross-reference at least two independent sources where possible.',
    'Flag discrepancies. Do not fabricate missing data — state where you searched.',
    '',
    'Format rules (preview/DOCX):',
    '- First output line is `[I] EXECUTIVE SUMMARY`. No chatter before it. Nothing after [VII].',
    '- Blank line after every [I]–[VII] header.',
    '- [II], [III], [IV], and [VI] labeled fields MUST be a markdown list (`- **Name:** value`).',
    '- Do not stack `**Label:**` lines without list markers — CommonMark joins them into one paragraph.',
    '- [I] and [VII] may stay as paragraphs. [V] is a table.',
    '',
    'In [II] FIRMOGRAPHICS use this list (not a prose/semicolon line):',
    '- **Name:** …',
    '- **Address:** street, City, ST ZIP',
    '- **Latitude:** …   (use the provided decimal degrees — do not invent)',
    '- **Longitude:** …  (use the provided decimal degrees — do not invent)',
    '- **Geocode source:** …',
    '- **Geocoded address:** … (Nominatim display name when provided)',
    '- **Phone:** …',
    '- **Website:** …',
    '- **GBP URL:** …   (MUST be https://www.google.com/maps?cid={CID} — never maps.app.goo.gl or share.google)',
    '- **GBP CID:** …   (raw Company ID digits from that URL)',
    '(Official Website is an accepted alias for Website. GB Map Share URL / Google Maps URL are accepted aliases for GBP URL.)',
    'In [V] DIGITAL ECOSYSTEM include a Google Maps (GBP) table row with that same CID URL (not a share or maps.app redirect).',
    '',
    'Return ONLY the seven-section dossier. No preamble, status updates, or closing questions.',
  ];

  if (pregatherBundle) {
    lines.push(buildPregatherUserAppendix(pregatherBundle));
  }

  return lines.filter((line) => line != null).join('\n');
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
    if (item?.type === 'reasoning' || item?.type === 'thinking') continue;
    if (typeof item?.content === 'string' && item.content.trim()) {
      chunks.push(item.content.trim());
      continue;
    }
    for (const part of item?.content || []) {
      if (part?.type === 'reasoning' || part?.type === 'thinking') continue;
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
  const { outputDir, mdPath, docxPath } = resolveOutputPaths(args);
  const slug = slugify(args.name);
  const log = [];
  let workDir = null;

  const intakeGbpUrl = args.gbpUrl;
  let mapsCid = null;
  try {
    mapsCid = await resolveMapsCid(intakeGbpUrl);
  } catch (err) {
    console.error(
      JSON.stringify(
        {
          error: 'Maps CID resolve failed',
          input: intakeGbpUrl,
          message: err.message,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  if (!mapsCid.ok || !mapsCid.cid_url) {
    console.error(
      JSON.stringify(
        {
          error:
            'Could not resolve Google Maps CID from --gbp-url. Do not write maps.app.goo.gl or share.google as GBP URL / hasMap.',
          input: intakeGbpUrl,
          final_url: mapsCid.final_url,
          redirect_chain: mapsCid.redirect_chain,
          parse_notes: mapsCid.parse_notes,
          hint: 'Pass a URL that resolves to https://www.google.com/maps?cid={CID} or a /maps/place/… link with a hex pair. Example: https://www.google.com/maps?cid=14463678168851604553',
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  args.gbpUrl = mapsCid.cid_url;
  args.gbpCid = mapsCid.cid;
  log.push(`Resolved Maps CID ${mapsCid.cid} → ${mapsCid.cid_url}`);

  args.geo = await geocodeAddress(args.address, {
    latitude: args.latitude,
    longitude: args.longitude,
    mapsUrl: intakeGbpUrl,
  });
  if (args.geo.ok) {
    const out = geoForOutput(args.geo);
    log.push(
      `Geocoded address → ${out.latitude}, ${out.longitude} (${out.source_label || args.geo.source})`
    );
  } else {
    log.push(`WARNING: could not geocode address: ${args.geo.error}`);
  }

  if (args.dryRun) {
    const summary = {
      dry_run: true,
      inputs: {
        name: args.name,
        address: args.address,
        phone: args.phone,
        website: args.website,
        gbp_url_intake: intakeGbpUrl,
        gbp_url: args.gbpUrl,
        gbp_cid: args.gbpCid,
        project_dir: projectDir,
        output_dir: outputDir,
        output_dir_override: Boolean(args.outputDir),
        model: args.model,
        skip_pregather: args.skipPregather,
        skip_firecrawl: args.skipFirecrawl,
        keep_artifacts: args.keepArtifacts,
      },
      coordinates: geoForOutput(args.geo),
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

  if (!args.geo?.ok) {
    const serpGeo = applySerpGpsFallback(args.geo, pregatherBundle?.place_details);
    if (serpGeo?.ok) {
      args.geo = serpGeo;
      const out = geoForOutput(args.geo);
      log.push(
        `Geocoded address (SerpAPI fallback) → ${out.latitude}, ${out.longitude}`
      );
    }
  }

  try {
    const userMessage = buildUserMessage(args, pregatherBundle);
    const { content, raw } = await callGrok({
      model: args.model,
      systemPrompt,
      userMessage,
      log,
    });

    const sanitized = sanitizeDossierMarkdown(content);
    if (sanitized !== (content.endsWith('\n') ? content : `${content}\n`)) {
      log.push('Sanitized dossier markdown (stripped chatter / list-formatted labels).');
    }

    const validation = validateSections(sanitized);
    if (!validation.ok) {
      log.push(`WARNING: missing sections: ${validation.missing.join(', ')}`);
    }

    let markdownOut = sanitized;
    fs.writeFileSync(mdPath, markdownOut, 'utf8');

    let firmographics = validateFirmographicsSection(mdPath);
    let firmographicsNormalized = false;
    if (!firmographics.labeled) {
      try {
        const norm = normalizeDossierFirmographics(mdPath, { write: true });
        firmographicsNormalized = Boolean(norm.normalized);
        if (firmographicsNormalized) {
          log.push(
            'Normalized [II] FIRMOGRAPHICS from prose/semicolon line to labeled **Field:** format.'
          );
          markdownOut = fs.readFileSync(mdPath, 'utf8');
          firmographics = validateFirmographicsSection(mdPath);
        }
      } catch (err) {
        log.push(`WARNING: could not normalize [II] FIRMOGRAPHICS: ${err.message}`);
        firmographics = validateFirmographicsSection(mdPath);
      }
    }

    const gbpEnsured = ensureGbpUrlInDossier(fs.readFileSync(mdPath, 'utf8'), args.gbpUrl, {
      cid: args.gbpCid,
    });
    if (gbpEnsured.changed) {
      markdownOut = gbpEnsured.markdown.endsWith('\n')
        ? gbpEnsured.markdown
        : `${gbpEnsured.markdown}\n`;
      fs.writeFileSync(mdPath, markdownOut, 'utf8');
      log.push(
        'Ensured **GBP URL:** (CID URL) and **GBP CID:** in [II] and Google Maps (GBP) row in [V].'
      );
      firmographics = validateFirmographicsSection(mdPath);
    } else {
      markdownOut = fs.readFileSync(mdPath, 'utf8');
    }

    const geoOut = geoForOutput(args.geo);
    if (geoOut.ok) {
      const coordsEnsured = ensureCoordinatesInDossier(markdownOut, {
        ok: true,
        latitude: geoOut.latitude,
        longitude: geoOut.longitude,
        source: geoOut.source_label || geocodeSourceLabel(args.geo.source),
        display_name: geoOut.display_name,
      });
      if (coordsEnsured.changed) {
        markdownOut = coordsEnsured.markdown.endsWith('\n')
          ? coordsEnsured.markdown
          : `${coordsEnsured.markdown}\n`;
        fs.writeFileSync(mdPath, markdownOut, 'utf8');
        log.push(
          `Ensured **Latitude:** ${coordsEnsured.latitude} and **Longitude:** ${coordsEnsured.longitude} in [II].`
        );
        firmographics = validateFirmographicsSection(mdPath);
      }
      if (!firmographics.latitude || !firmographics.longitude) {
        log.push('WARNING: [II] FIRMOGRAPHICS missing **Latitude:** / **Longitude:** after inject.');
        firmographics = {
          ...firmographics,
          ok: false,
          missing: [
            ...new Set([
              ...(firmographics.missing || []),
              '**Latitude:**',
              '**Longitude:**',
            ]),
          ],
        };
      }
    }

    if (!firmographics.gbp_url) {
      log.push('WARNING: [II] FIRMOGRAPHICS missing **GBP URL:** after inject.');
      firmographics = {
        ...firmographics,
        ok: false,
        missing: [...(firmographics.missing || []), '**GBP URL:**'],
      };
    }

    if (!firmographics.ok) {
      log.push(
        `WARNING: [II] FIRMOGRAPHICS incomplete or unlabeled (missing: ${
          firmographics.missing?.join(', ') || 'parseable address'
        }). Downstream geo/crawl parsers expect **Name:** / **Address:** / **Latitude:** / **Longitude:** / **Phone:** / **Website:**. **GBP URL:** is required in the dossier output.`
      );
    }

    writeMarkdownDossierDocx({
      markdown: markdownOut,
      outputPath: docxPath,
      header: pregatherBundle?.docx_header || { businessName: args.name },
    });

    const sectionOk = validation.ok && firmographics.ok;
    console.log(
      JSON.stringify(
        {
          ok: sectionOk,
          business_name: args.name,
          gbp_url: args.gbpUrl,
          gbp_cid: args.gbpCid,
          coordinates: geoForOutput(args.geo),
          output_dir: outputDir,
          markdown: mdPath,
          docx: docxPath,
          section_validation: validation,
          firmographics_validation: firmographics,
          firmographics_normalized: firmographicsNormalized,
          model: args.model,
          xai_usage: raw.usage || null,
          cost_usd: xaiCostFromUsage(raw.usage),
          warnings: log.filter((line) => line.startsWith('WARNING:')),
        },
        null,
        2
      )
    );

    cleanupWorkDir(workDir, args.keepArtifacts, log);

    if (!sectionOk) {
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
