#!/usr/bin/env bun
/**
 * Content Maxima — Personas Generator
 *
 * Usage:
 *   bun run Personas.ts "press releases"
 *   bun run Personas.ts "seo" --output ~/Documents --model gpt-4o-mini
 */

import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, waitForDownload, downloadFile, screenshotOnError, printHeader } from './shared';

const TOOL = 'Personas';
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <keyword> [--output <dir>] [--headless <true|false>] [--model <model>]`);
printHeader(TOOL, args);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to personas page...`);
  await navigateTo(page, '/personas', '#keyword');

  console.log(`[3] Generating personas for "${args.keyword}"...`);
  await setModel(page, args.model);
  await page.locator('#keyword').fill(args.keyword);
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
