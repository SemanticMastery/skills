#!/usr/bin/env bun
/**
 * Content Maxima — Analysis Generator
 *
 * Usage:
 *   bun run Analysis.ts "press releases"
 *   bun run Analysis.ts "seo" --related 10 --tier2 5
 *   bun run Analysis.ts "keyword" --output ~/Documents --model gpt-4o-mini
 */

import { resolve } from 'path';
import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, waitForDownload, downloadFile, screenshotOnError, printHeader } from './shared';

const TOOL = 'Analysis';
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <keyword> [--related <n>] [--tier2 <n>] [--output <dir>] [--headless <true|false>] [--model <model>]`);

// Parse extra args
let related = '5';
let tier2 = '3';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--related' && argv[i + 1]) related = argv[++i];
  if (argv[i] === '--tier2' && argv[i + 1]) tier2 = argv[++i];
}

printHeader(TOOL, args);
console.log(`  Related terms: ${related}`);
console.log(`  Tier 2 terms:  ${tier2}\n`);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to analysis page...`);
  await navigateTo(page, '/analysis', '#keyword');

  console.log(`[3] Generating analysis for "${args.keyword}"...`);
  await setModel(page, args.model);
  await page.locator('#keyword').fill(args.keyword);
  await page.locator('#related-terms').fill(related);
  await page.locator('#tier2-terms').fill(tier2);
  await clickGenerate(page);
  console.log('  Waiting for completion (up to 3 min)...');
  await waitForDownload(page);

  console.log(`[4] Downloading...`);
  const filePath = await downloadFile(page, args.output, args.keyword);
  console.log(`\nDone! Saved to: ${filePath}`);
} catch (error) {
  console.error('\nError:', (error as Error).message);
  await screenshotOnError(page, args.output);
  process.exit(1);
} finally {
  await browser.close();
}
