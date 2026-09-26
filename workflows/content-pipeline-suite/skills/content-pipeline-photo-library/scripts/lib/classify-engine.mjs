/**
 * Shared classify engine. No business-specific KEEP / OFF_TOPIC text.
 * The campaign file at image-library/classify.mjs supplies buildClassifyPrompt.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  campaignClassifierPath,
  emptyFlags,
  FLAG_KEYS,
  imageExtFromBytes,
  isAllowedImagePath,
  isEphemeralCaption,
  libraryDir,
  loadManifest,
  moveItemBinary,
  saveManifest,
  taxonomyPath as taxonomyFile,
} from "./library.mjs";
import {
  countyTagsFromCaption,
  dropInvalidTags,
  isCountyTag,
  loadTaxonomyFile,
} from "./taxonomy.mjs";

const GEMINI_MODEL = process.env.PHOTO_LIBRARY_GEMINI_MODEL || "gemini-2.5-flash";

export function renderReviewQueue(manifest) {
  const pending = (manifest.items || []).filter((i) => i.status === "review");
  const lines = [
    "# Photo library review queue",
    "",
    "Operator phrases: `approve {id}` · `reject {id}` · `retag {id} as {allowlist tags}` · `requeue {id}`",
    "",
    "The agent applies decisions with `apply-review.mjs`. It must not self-approve.",
    "`content-pipeline-run` `gate_mode=auto` does not skip this gate.",
    "",
    "| id | image | proposed_tags | flags | source | caption |",
    "|----|-------|---------------|-------|--------|---------|",
  ];
  for (const it of pending) {
    const flags = FLAG_KEYS.filter((k) => it.flags?.[k]).join(",") || "—";
    const tags = (it.proposed_tags || []).join(", ");
    lines.push(
      `| ${it.id} | ${it.rel_path} | ${tags} | ${flags} | ${it.source_platform} | ${(it.caption || "").replace(/\|/g, "/")} |`,
    );
  }
  if (!pending.length) lines.push("| — | — | queue empty | — | — | — |");
  lines.push("");
  return lines.join("\n");
}

export function writeReviewQueue(libDir, manifest) {
  fs.writeFileSync(path.join(libDir, "review-queue.md"), renderReviewQueue(manifest), "utf8");
}

function mergeFlags(raw) {
  const flags = emptyFlags();
  for (const k of FLAG_KEYS) {
    if (raw && typeof raw[k] === "boolean") flags[k] = raw[k];
  }
  return flags;
}

export function shouldOmitFromReview(item) {
  return Boolean(
    item?.flags?.off_topic ||
      item?.flags?.ephemeral_promo ||
      isEphemeralCaption(item?.caption),
  );
}

function omitNotImage(libDir, item) {
  if (!isAllowedImagePath(item.rel_path)) return true;
  const abs = path.join(libDir, item.rel_path);
  if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) return true;
  return !imageExtFromBytes(fs.readFileSync(abs));
}

export async function loadCampaignClassifier(pipelineDir) {
  const classifierPath = campaignClassifierPath(pipelineDir);
  if (!fs.existsSync(classifierPath)) {
    const err = new Error(
      `Missing campaign classifier at ${classifierPath}. Copy content-pipeline-photo-library/templates/classify.mjs into this image-library, write KEEP/OFF_TOPIC for THIS business, and set CLASSIFIER_READY = true. Do not classify from a shared skill prompt.`,
    );
    err.code = "MISSING_CAMPAIGN_CLASSIFIER";
    throw err;
  }
  const href = `${pathToFileURL(classifierPath).href}?mtime=${fs.statSync(classifierPath).mtimeMs}`;
  const mod = await import(href);
  if (mod.CLASSIFIER_READY === false) {
    const err = new Error(
      `Campaign classifier at ${classifierPath} is still the unedited template. Edit KEEP/OFF_TOPIC for this business and set CLASSIFIER_READY = true.`,
    );
    err.code = "TEMPLATE_CLASSIFIER";
    throw err;
  }
  if (typeof mod.buildClassifyPrompt !== "function") {
    const err = new Error(
      `Campaign classifier at ${classifierPath} must export buildClassifyPrompt({ allowlist, caption }).`,
    );
    err.code = "INVALID_CAMPAIGN_CLASSIFIER";
    throw err;
  }
  return { classifierPath, ...mod };
}

export async function geminiClassify({
  imagePath,
  allowlist,
  caption,
  buildClassifyPrompt,
}) {
  if (typeof buildClassifyPrompt !== "function") {
    const err = new Error(
      "classify-engine requires buildClassifyPrompt from the campaign image-library/classify.mjs",
    );
    err.code = "MISSING_PROMPT_BUILDER";
    throw err;
  }
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) {
    const err = new Error(
      "GEMINI_API_KEY is not set. Pass --classifications for fixtures, or set GEMINI_API_KEY for live Gemini Flash.",
    );
    err.code = "MISSING_GEMINI_KEY";
    throw err;
  }
  const buf = fs.readFileSync(imagePath);
  const b64 = buf.toString("base64");
  const mime = imagePath.toLowerCase().endsWith(".png")
    ? "image/png"
    : imagePath.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  const schema = {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string", enum: allowlist },
      },
      confidence: { type: "number" },
      scene: { type: "string" },
      flags: {
        type: "object",
        properties: {
          has_text: { type: "boolean" },
          has_logo: { type: "boolean" },
          likely_ugc: { type: "boolean" },
          has_people: { type: "boolean" },
          off_topic: { type: "boolean" },
          ephemeral_promo: { type: "boolean" },
        },
        required: [
          "has_text",
          "has_logo",
          "likely_ugc",
          "has_people",
          "off_topic",
          "ephemeral_promo",
        ],
      },
    },
    required: ["tags", "confidence", "scene", "flags"],
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: buildClassifyPrompt({ allowlist, caption }) },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
      temperature: 0.2,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 400)}`);
    err.code = "GEMINI_FAILED";
    throw err;
  }
  const json = await res.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
  return JSON.parse(text);
}

export async function classifyLibrary({
  campaignDir,
  pipelineDir,
  stubMap,
  buildClassifyPrompt,
}) {
  if (typeof buildClassifyPrompt !== "function") {
    const loaded = await loadCampaignClassifier(pipelineDir);
    buildClassifyPrompt = loaded.buildClassifyPrompt;
  }
  const taxPath = taxonomyFile(pipelineDir);
  const taxonomy = loadTaxonomyFile(taxPath);
  const libDir = libraryDir(pipelineDir);
  const manifest = loadManifest(libDir);
  manifest.campaign_dir = campaignDir;
  manifest.pipeline_dir = pipelineDir;

  const inbox = (manifest.items || []).filter((i) => i.status === "inbox");
  const summary = { classified: 0, omitted: 0, errors: [] };

  for (const item of inbox) {
    if (omitNotImage(libDir, item)) {
      item.rights_notes = "not_image";
      item.proposed_tags = [];
      try {
        moveItemBinary(libDir, item, "rejected");
      } catch (err) {
        summary.errors.push(`${item.id}: ${err.message}`);
        continue;
      }
      summary.omitted += 1;
      continue;
    }
    const imagePath = path.join(libDir, item.rel_path);
    let raw;
    try {
      if (stubMap && stubMap[item.id]) raw = stubMap[item.id];
      else {
        raw = await geminiClassify({
          imagePath,
          allowlist: taxonomy.allowlist,
          caption: item.caption,
          buildClassifyPrompt,
        });
      }
    } catch (err) {
      summary.errors.push(`${item.id}: ${err.message}`);
      continue;
    }
    const { kept } = dropInvalidTags(raw.tags || [], taxonomy.allowlist);
    const topicOnly = kept.filter((t) => !isCountyTag(t));
    const geo = countyTagsFromCaption(item.caption, taxonomy.cityToCounty);
    const { kept: geoKept } = dropInvalidTags(geo, taxonomy.allowlist);
    const proposed = [...new Set([...topicOnly, ...geoKept])];

    item.proposed_tags = proposed;
    item.approved_tags = [];
    item.confidence = typeof raw.confidence === "number" ? raw.confidence : null;
    item.flags = mergeFlags(raw.flags);
    item.scene = raw.scene || item.scene || "";
    if (item.status === "approved") {
      const err = new Error("classify cannot set status approved");
      err.code = "CLASSIFY_APPROVE_FORBIDDEN";
      throw err;
    }
    try {
      if (shouldOmitFromReview(item)) {
        item.rights_notes = item.flags.off_topic ? "off_topic" : "ephemeral_promo";
        item.proposed_tags = [];
        moveItemBinary(libDir, item, "rejected");
        summary.omitted += 1;
        continue;
      }
      moveItemBinary(libDir, item, "review");
      summary.classified += 1;
    } catch (err) {
      summary.errors.push(`${item.id}: ${err.message}`);
    }
  }

  saveManifest(libDir, manifest);
  writeReviewQueue(libDir, manifest);
  return { libDir, summary, manifest };
}
