import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { makeTempCampaign, rmrf, test } from "./helpers.mjs";
import { seedCampaignImageHelpers } from "../lib/library.mjs";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SEED = path.join(DIR, "..", "seed-helpers.mjs");

await test("seedCampaignImageHelpers writes match-library + fal-generate into pipeline/scripts", () => {
  const camp = makeTempCampaign("seed-helpers");
  try {
    const result = seedCampaignImageHelpers(camp.pipelineDir);
    assert.ok(result.copied.includes("match-library.mjs"));
    assert.ok(result.copied.includes("lib/campaign.mjs"));
    assert.ok(result.copied.includes("fal-generate.mjs"));
    assert.ok(
      fs.existsSync(path.join(camp.pipelineDir, "scripts", "match-library.mjs")),
    );
    assert.ok(
      fs.existsSync(path.join(camp.pipelineDir, "scripts", "fal-generate.mjs")),
    );
    assert.ok(
      fs.existsSync(path.join(camp.pipelineDir, "scripts", "lib", "library.mjs")),
    );
  } finally {
    rmrf(camp.root);
  }
});

await test("seed-helpers.mjs CLI requires campaign_dir and writes the folder", () => {
  const camp = makeTempCampaign("seed-cli");
  try {
    const missing = spawnSync(process.execPath, [SEED], { encoding: "utf8" });
    assert.notEqual(missing.status, 0);
    const ok = spawnSync(
      process.execPath,
      [SEED, "--campaign-dir", camp.campaignDir],
      { encoding: "utf8" },
    );
    assert.equal(ok.status, 0, ok.stderr || ok.stdout);
    const json = JSON.parse(ok.stdout);
    assert.equal(json.ok, true);
    assert.ok(json.copied.includes("match-library.mjs"));
  } finally {
    rmrf(camp.root);
  }
});
