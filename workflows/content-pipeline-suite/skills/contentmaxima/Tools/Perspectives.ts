#!/usr/bin/env bun
/**
 * Content Maxima — Perspectives Generator
 *
 * Selects all analysis categories by default. Pass --categories to pick specific ones.
 *
 * Usage:
 *   bun run Perspectives.ts "press releases"
 *   bun run Perspectives.ts "seo" --categories "seo,conversion"
 *   bun run Perspectives.ts "keyword" --output ~/Documents --model gpt-4o-mini
 *
 * Available categories (checkbox IDs):
 *   persona_audience_insights, customer_journey_intent_mapping,
 *   positioning_strategy, content_types_formats,
 *   trend_review_based_content, seo_search_engine_optimized_content,
 *   seasonal_geographic_cultural_content, legal_compliance_risk_reduction_content,
 *   conversion_engagement_content, pricing_value_based_positioning,
 *   post_purchase_loyalty_content, innovation_future_proofing_content,
 *   all (selects everything)
 */

import { parseBaseArgs, launchBrowser, login, navigateTo, setModel, clickGenerate, waitForDownload, downloadFile, screenshotOnError, printHeader } from './shared';

const TOOL = 'Perspectives';
const args = await parseBaseArgs(`Usage: bun run ${TOOL}.ts <keyword> [--categories <ids>] [--output <dir>] [--headless <true|false>] [--model <model>]`);

let categories = 'all';
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--categories' && argv[i + 1]) categories = argv[++i];
}

printHeader(TOOL, args);
console.log(`  Categories: ${categories}\n`);

const { browser, page } = await launchBrowser(args.headless);

try {
  await login(page, args.email, args.password);

  console.log(`[2] Navigating to perspectives page...`);
  await navigateTo(page, '/perspectives', '#keyword');

  console.log(`[3] Generating perspectives for "${args.keyword}"...`);
  await setModel(page, args.model);
  await page.locator('#keyword').fill(args.keyword);

  // Check categories
  if (categories === 'all') {
    await page.locator('#all').click({ force: true });
  } else {
    for (const cat of categories.split(',')) {
      const id = cat.trim();
      await page.locator(`#${id}`).click({ force: true });
    }
  }

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
