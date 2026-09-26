#!/usr/bin/env bun
/**
 * Content Maxima — Pathways Generator
 *
 * Requires both an entity and a persona.
 *
 * Usage:
 *   bun run Pathways.ts "press releases" --persona "marketing manager"
 *   bun run Pathways.ts "seo" --persona "content strategist" --output ~/Documents
 */

import { resolve } from 'path';
import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, waitForDownload, downloadFile, screenshotOnError, printHeader } from './shared';

const TOOL = 'Pathways';
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <entity> --persona <persona> [--output <dir>] [--headless <true|false>] [--model <model>]`);

// Parse persona arg
let persona = '';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--persona' && argv[i + 1]) persona = argv[++i];
}
if (!persona) {
  console.error('Error: --persona is required for Pathways');
  console.error('Usage: bun run Pathways.ts <entity> --persona <persona>');
  process.exit(1);
}

printHeader(TOOL, args);
console.log(`  Persona: "${persona}"\n`);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to pathways page...`);
  await navigateTo(page, '/pathways', '#entity');

  console.log(`[3] Generating pathways for "${args.keyword}" / "${persona}"...`);
  await setModel(page, args.model);
  await page.locator('#entity').fill(args.keyword);
  await page.locator('#persona').fill(persona);
  await clickGenerate(page);
  console.log('  Waiting for completion (up to 3 min)...');
  await waitForDownload(page);

  console.log(`[4] Downloading...`);
  const filePath = await downloadFile(page, args.output, args.keyword, 'pdf');
  console.log(`\nDone! Saved to: ${filePath}`);
} catch (error) {
  console.error('\nError:', (error as Error).message);
  await screenshotOnError(page, args.output);
  process.exit(1);
} finally {
  await browser.close();
}
