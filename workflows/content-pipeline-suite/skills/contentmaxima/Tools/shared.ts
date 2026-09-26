/**
 * Shared helpers for Content Maxima automation scripts (Cursor standalone).
 */

import { chromium, type Page, type BrowserContext, type Browser } from "playwright";
import { existsSync, mkdirSync } from "fs";
import { resolve, join } from "path";
import { isPlaceholderSecret, resolveSecret } from "../lib/resolve-env";

/** Default output directory: ContentMaxima/ under CWD */
const DEFAULT_OUTPUT = join(process.cwd(), "ContentMaxima");

export const BASE_URL = "https://content-maxima.web.app";
export const LOGIN_TIMEOUT = 30_000;
export const GENERATION_TIMEOUT = 180_000;
export const DOWNLOAD_TIMEOUT = 60_000;

export interface BaseArgs {
  keyword: string;
  output: string;
  headless: boolean;
  model?: string;
  email: string;
  password: string;
}

export async function parseBaseArgs(usage: string): Promise<BaseArgs> {
  const args = process.argv.slice(2);
  const keyword = args.find((a) => !a.startsWith("--"));
  if (!keyword) {
    console.error(usage);
    process.exit(1);
  }

  let output = DEFAULT_OUTPUT;
  let headless = true;
  let model: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--output" && args[i + 1]) output = resolve(args[++i]);
    if (args[i] === "--headless") headless = args[++i] !== "false";
    if (args[i] === "--model" && args[i + 1]) model = args[++i];
  }

  const email = await resolveSecret("CONTENT_MAXIMA_EMAIL");
  const password = await resolveSecret("CONTENT_MAXIMA_PASSWORD");

  if (!email || !password || isPlaceholderSecret(email) || isPlaceholderSecret(password)) {
    console.error(
      "Missing real Content Maxima credentials. Skill-root .env is the example template. Set Windows User env CONTENT_MAXIMA_EMAIL and CONTENT_MAXIMA_PASSWORD, or put them in %USERPROFILE%\\.contentmaxima\\.env. Do not paste them into chat."
    );
    process.exit(1);
  }

  return { keyword, output, headless, model, email, password };
}

export async function launchBrowser(
  headless: boolean
): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function login(page: Page, email: string, password: string) {
  console.log("[1] Logging in...");
  await page.goto(`${BASE_URL}/login`, {
    waitUntil: "domcontentloaded",
    timeout: LOGIN_TIMEOUT,
  });
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button:has-text("Login")').click();
  await page.waitForURL((url) => !url.toString().includes("/login"), {
    timeout: LOGIN_TIMEOUT,
  });
  console.log("  Logged in");
}

export async function navigateTo(page: Page, path: string, waitFor: string) {
  await page.goto(`${BASE_URL}${path}`, {
    waitUntil: "domcontentloaded",
    timeout: LOGIN_TIMEOUT,
  });
  await page.waitForSelector(waitFor, { timeout: 10_000 });
}

export async function setModel(page: Page, model?: string) {
  if (model) {
    const select = page.locator("select#gptModel");
    if (await select.count()) {
      await select.selectOption(model);
      console.log(`  Model: ${model}`);
    }
  }
}

export async function clickGenerate(page: Page) {
  await page.locator("button.start-button").click();
}

export async function waitForDownload(page: Page, timeout = GENERATION_TIMEOUT) {
  await page
    .locator('button:has-text("Download"), a:has-text("Download")')
    .first()
    .waitFor({ state: "visible", timeout });
}

export async function downloadFile(
  page: Page,
  outputDir: string,
  keyword: string,
  fallbackExt = "xlsx"
): Promise<string> {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const downloadPromise = page.waitForEvent("download", {
    timeout: DOWNLOAD_TIMEOUT,
  });
  await page
    .locator('button:has-text("Download"), a:has-text("Download")')
    .first()
    .click();
  const download = await downloadPromise;
  const suggestedName = download.suggestedFilename();
  const outputPath = join(
    outputDir,
    suggestedName ||
      `content-maxima-${keyword.replace(/\s+/g, "-")}.${fallbackExt}`
  );
  await download.saveAs(outputPath);
  return outputPath;
}

export async function downloadAllFiles(
  page: Page,
  outputDir: string
): Promise<string[]> {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const files: string[] = [];
  const downloads: { suggestedFilename: () => string; saveAs: (p: string) => Promise<void> }[] = [];
  page.on("download", (d) => downloads.push(d));

  const downloadAllBtn = page.locator('button:has-text("Download All")');
  await downloadAllBtn.click();
  await page.waitForTimeout(10000);

  for (const d of downloads) {
    const name = d.suggestedFilename();
    const path = join(outputDir, name);
    await d.saveAs(path);
    files.push(path);
  }

  return files;
}

export async function screenshotOnError(page: Page, dir: string) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const path = join(dir, `debug-error-${Date.now()}.png`);
  await page.screenshot({ path, fullPage: true });
  console.log(`  [debug] Screenshot: ${path}`);
}

export function printHeader(tool: string, args: BaseArgs) {
  console.log(`Content Maxima ${tool}`);
  console.log(`  Keyword: "${args.keyword}"`);
  console.log(`  Output:  ${args.output}`);
  console.log(`  Mode:    ${args.headless ? "headless" : "headed"}`);
  if (args.model) console.log(`  Model:   ${args.model}`);
  console.log("");
}
