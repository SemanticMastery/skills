#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachStoryBank, refreshStoryBank } from "../lib/story-bank.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.join(HERE, "..", "check-ready.mjs");
const SCAFFOLD = path.join(
  HERE,
  "..",
  "..",
  "..",
  "content-pipeline-init",
  "scripts",
  "scaffold-icm.mjs",
);
const TEMPLATE = process.env.CONTENT_PIPELINE_ICM_TEMPLATE || "";

function test(name, fn) {
  try {
    fn();
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function tmpCampaign() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-"));
  const campaign = path.join(root, "Ridgeline-Tree-Care");
  fs.mkdirSync(path.join(campaign, "01-intake", "1.1-docs"), { recursive: true });
  fs.mkdirSync(path.join(campaign, "06-content-pipeline", "01-resources"), { recursive: true });
  return { root, campaign };
}

function writeStub(dir, body, status = 0) {
  const script = path.join(dir, "bank-stub.mjs");
  fs.writeFileSync(script, `#!/usr/bin/env node\nconsole.log(${JSON.stringify(body)});\nprocess.exit(${status});\n`);
  return script;
}

test("no series skips refresh (AE7)", () => {
  const { campaign, root } = tmpCampaign();
  const result = refreshStoryBank(campaign);
  assert.deepEqual(result, { skipped: "no_series" });
  const attached = attachStoryBank({ ready: false }, campaign);
  assert.equal(attached.warnings, undefined);
  assert.equal(attached.story_bank, undefined);
  fs.rmSync(root, { recursive: true, force: true });
});

test("check-ready without series has no warning (AE7)", () => {
  const { campaign, root } = tmpCampaign();
  const r = spawnSync(process.execPath, [CHECK, "--campaign-dir", campaign], { encoding: "utf8" });
  const json = JSON.parse(r.stdout);
  assert.equal(json.warnings, undefined);
  assert.equal(json.story_bank, undefined);
  assert.equal(json.ready, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("series + stub exit 1 keeps ready and adds warning (AE14)", () => {
  const { campaign, root } = tmpCampaign();
  fs.writeFileSync(
    path.join(campaign, "01-intake", "1.1-docs", "Ridgeline-Tree-Care-expert-interview-series.json"),
    "{}",
  );
  const stub = writeStub(root, JSON.stringify({ error: "host_unreachable" }), 1);
  const result = attachStoryBank({ ready: true }, campaign, { bankScript: stub });
  assert.equal(result.ready, true);
  assert.equal(result.warnings.length, 1);
  fs.rmSync(root, { recursive: true, force: true });
});

test("stubbed success includes story_bank.new_entries", () => {
  const { campaign, root } = tmpCampaign();
  fs.writeFileSync(
    path.join(campaign, "01-intake", "1.1-docs", "Ridgeline-Tree-Care-expert-interview-series.json"),
    "{}",
  );
  const stub = writeStub(root, JSON.stringify({ ok: true, new_entries: 2 }), 0);
  const result = attachStoryBank({ ready: false }, campaign, { bankScript: stub });
  assert.equal(result.story_bank.new_entries, 2);
  assert.equal(result.ready, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("scaffold --refresh-context overwrites only the named file", () => {
  const { campaign, root } = tmpCampaign();
  const dest = path.join(campaign, "06-content-pipeline", "03-write", "3.1-brief");
  const other = path.join(campaign, "06-content-pipeline", "03-write", "3.2-draft");
  fs.mkdirSync(dest, { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  fs.writeFileSync(path.join(dest, "CONTEXT.md"), "OLD BRIEF\n");
  fs.writeFileSync(path.join(other, "CONTEXT.md"), "OLD DRAFT\n");
  const r = spawnSync(
    process.execPath,
    [
      SCAFFOLD,
      "--campaign-dir",
      campaign,
      "--template",
      TEMPLATE,
      "--refresh-context",
      "03-write/3.1-brief/CONTEXT.md",
    ],
    { encoding: "utf8" },
  );
  assert.equal(r.status, 0, r.stderr || r.stdout);
  const brief = fs.readFileSync(path.join(dest, "CONTEXT.md"), "utf8");
  assert.match(brief, /Story bank entries used:/);
  assert.equal(fs.readFileSync(path.join(other, "CONTEXT.md"), "utf8"), "OLD DRAFT\n");
  fs.rmSync(root, { recursive: true, force: true });
});

test("3.1 templates keep Story bank line inside output_format", () => {
  const trees = [
    TEMPLATE,
    path.join(HERE, "..", "..", "..", "..", "Shareable", "_staging", "_templates", "Content-Pipeline-ICM"),
    path.join(HERE, "..", "..", "..", "..", "Shareable", "_packaging", "dist", "content-pipeline-suite", "templates", "Content-Pipeline-ICM"),
  ];
  for (const tree of trees) {
    const brief = fs.readFileSync(path.join(tree, "03-write", "3.1-brief", "CONTEXT.md"), "utf8");
    const block = brief.slice(brief.indexOf("<output_format>"), brief.indexOf("</output_format>"));
    assert.match(block, /Story bank entries used:/);
    const draft = fs.readFileSync(path.join(tree, "03-write", "3.2-draft", "CONTEXT.md"), "utf8");
    assert.match(draft, /Story bank entries used:/);
  }
});
