#!/usr/bin/env bun
/**
 * Content Maxima — Matrix Generator
 *
 * Usage:
 *   bun run Matrix.ts "press releases"
 *   bun run Matrix.ts "seo" --output ~/Documents
 *   bun run Matrix.ts "keyword" --headless false
 *   bun run Matrix.ts "keyword" --model gpt-4o-mini
 */

import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, waitForDownload, downloadFile, screenshotOnError, printHeader } from './shared';

const TOOL = 'Matrix';
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <keyword> [--output <dir>] [--headless <true|false>] [--model <model>]`);
printHeader(TOOL, args);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to matrix page...`);
  await navigateTo(page, '/matrix', 'input[type="text"]');

  console.log(`[3] Generating matrix for "${args.keyword}"...`);
  await setModel(page, args.model);
  await page.locator('input[type="text"]').fill(args.keyword);
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
