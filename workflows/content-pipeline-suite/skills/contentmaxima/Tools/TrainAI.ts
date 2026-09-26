#!/usr/bin/env bun
/**
 * Content Maxima — Train AI (Aggregator)
 *
 * Runs ALL modules (Analysis, Matrix, Pathways, Personas, Perspectives, Signatures)
 * for a keyword and downloads all generated files.
 *
 * Usage:
 *   bun run TrainAI.ts "press releases"
 *   bun run TrainAI.ts "seo" --output ~/Documents --model gpt-4o-mini
 */

import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, screenshotOnError, printHeader } from './shared';

const TOOL = 'TrainAI';
const TRAINAI_TIMEOUT = 600_000; // 10 minutes for all modules
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <keyword> [--output <dir>] [--headless <true|false>] [--model <model>]`);
printHeader(TOOL, args);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to Train AI page...`);
  await navigateTo(page, '/trainai', '#keyword');

  console.log(`[3] Training AI for "${args.keyword}"...`);
  await setModel(page, args.model);
  await page.locator('#keyword').fill(args.keyword);
  await clickGenerate(page);
  console.log('  Running all 6 modules. This takes ~2-3 minutes...');

  // Wait for all modules to complete by watching for "Download All Files (6)"
  // Poll the progress indicator
  const startTime = Date.now();
  let lastCount = 0;
  while (Date.now() - startTime < TRAINAI_TIMEOUT) {
    await page.waitForTimeout(10_000);

    // Check if "Download All" button exists and its count
    const downloadAllBtn = page.locator('button:has-text("Download All")');
    if (await downloadAllBtn.count()) {
      const btnText = await downloadAllBtn.textContent();
      const countMatch = btnText?.match(/\((\d+)\)/);
      const count = countMatch ? parseInt(countMatch[1]) : 0;

      if (count !== lastCount) {
        console.log(`  Progress: ${count}/6 modules complete`);
        lastCount = count;
      }

      if (count >= 6) {
        console.log('  All modules complete!');
        break;
      }
    }

    // Check if button reverted to non-"Training..." state (generation finished)
    const startBtn = page.locator('button.start-button');
    if (await startBtn.count()) {
      const btnText = await startBtn.textContent();
      if (btnText?.trim() === 'Train AI' && lastCount > 0) {
        console.log('  Generation finished (button reset)');
        break;
      }
    }
  }

  // Download all files
  console.log(`[4] Downloading all files...`);
  if (!existsSync(args.output)) mkdirSync(args.output, { recursive: true });

  const downloadAllBtn = page.locator('button:has-text("Download All")');
  if (await downloadAllBtn.count()) {
    const files: string[] = [];
    const downloads: any[] = [];
    page.on('download', (d: any) => downloads.push(d));

    await downloadAllBtn.click();
    // Wait for downloads to come in
    await page.waitForTimeout(15_000);

    for (const d of downloads) {
      const name = d.suggestedFilename();
      const path = join(args.output, name);
      await d.saveAs(path);
      files.push(path);
      console.log(`  Downloaded: ${name}`);
    }

    console.log(`\nDone! ${files.length} files saved to: ${args.output}`);
  } else {
    console.error('No Download All button found');
    await screenshotOnError(page, args.output);
    process.exit(1);
  }
} catch (error) {
  console.error('\nError:', (error as Error).message);
  await screenshotOnError(page, args.output);
  process.exit(1);
} finally {
  await browser.close();
}
