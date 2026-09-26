import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export const FIXTURES = path.join(HERE, "fixtures");

/** 1x1 PNG */
export const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export const BOX_ALLOWLIST = [
  "Emergencies",
  "Tree Care",
  "Tree Pruning",
  "Tree Removal",
  "Tree Diseases",
  "Tree Pests",
  "Land Clearing",
  "Seasonal Prep",
  "Summit County",
  "Valley County",
];

export function fixtureTaxonomyMd() {
  return `# SiteSwarm tag taxonomy — fixture

## Allowlist

| Tag | Use for |
|-----|---------|
| Emergencies | Storm damage |
| Tree Care | General |
| Tree Pruning | Pruning |
| Tree Removal | Removal |
| Tree Diseases | Disease |
| Tree Pests | Pests |
| Land Clearing | Clearing |
| Seasonal Prep | Seasonal |
| Summit County | Fairview, Brookfield, Millbrook, Clearwater |
| Valley County | Denver / North Metro |

### City → county quick ref

| City / area | County tag |
|-------------|------------|
| Fairview, Brookfield, Millbrook, Clearwater | Summit County |
| Denver, North Metro (Valley side) | Valley County |
`;
}

/** Write a campaign-owned image-library/classify.mjs (required before classify). */
export function writeCampaignClassifier(
  pipelineDir,
  {
    ready = true,
    keep = "page-owned stills that match the campaign tag enum",
    offTopic = "sports, parties, wrecked cars as the subject, or anything outside the tag enum",
  } = {},
) {
  const lib = path.join(pipelineDir, "01-resources", "image-library");
  fs.mkdirSync(lib, { recursive: true });
  const src = `export const CLASSIFIER_READY = ${ready};
export const KEEP = ${JSON.stringify(keep)};
export const OFF_TOPIC = ${JSON.stringify(offTopic)};
export function buildClassifyPrompt({ allowlist, caption }) {
  return [
    "Tag this photo only if it is an evergreen, page-owned still for this campaign.",
    "KEEP: " + KEEP + ".",
    "Set off_topic=true for " + OFF_TOPIC + ".",
    "Set ephemeral_promo=true for fundraising graphics, donate/Venmo overlays, dated event flyers, or other time-limited campaign text.",
    "Use only the provided tag enum. Do not invent tags.",
    "Business topics (tag enum): " + JSON.stringify(allowlist) + ".",
    "Caption: " + JSON.stringify(caption || ""),
  ].join(" ");
}
`;
  const dest = path.join(lib, "classify.mjs");
  fs.writeFileSync(dest, src, "utf8");
  return dest;
}

export function makeTempCampaign(prefix = "photo-lib") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
  const campaignDir = path.join(root, "Example-Campaign");
  const pipelineDir = path.join(campaignDir, "06-content-pipeline");
  const planDir = path.join(pipelineDir, "02-plan");
  const publishDir = path.join(pipelineDir, "04-publish");
  const resourcesDir = path.join(pipelineDir, "01-resources");
  fs.mkdirSync(planDir, { recursive: true });
  fs.mkdirSync(publishDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  fs.writeFileSync(
    path.join(planDir, "siteswarm-tag-taxonomy.md"),
    fixtureTaxonomyMd(),
    "utf8",
  );
  return { root, campaignDir, pipelineDir, planDir, publishDir, resourcesDir };
}

export function rmrf(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

export function test(name, fn) {
  try {
    const out = fn();
    if (out && typeof out.then === "function") {
      return out.then(
        () => {
          console.log(`ok  ${name}`);
        },
        (err) => {
          console.error(`FAIL  ${name}`);
          console.error(err);
          process.exitCode = 1;
        },
      );
    }
    console.log(`ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}
