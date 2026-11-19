#!/usr/bin/env node
/**
 * Print the Google Place ID for a dossier or a raw GBP CID.
 *
 * --dossier PATH   Read **Place ID:** / **GBP CID:** from [II]
 * --cid DIGITS     CID when no dossier is passed
 * --write          Write **Place ID:** into the dossier when it was missing
 *
 * Existing valid Place ID: no network. Missing Place ID: SerpAPI data_cid.
 */

import fs from "fs";
import { ensurePlaceIdInDossier, parseGbpAnchorFromDossier } from "./lib/dossier-firmographics.mjs";
import { isGooglePlaceId } from "./lib/place-id.mjs";
import { resolvePlaceIdFromCid } from "./lib/resolve-place-id.mjs";

function arg(name) {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return null;
  return process.argv[i + 1];
}

function emit(payload, code) {
  console.log(JSON.stringify(payload));
  process.exit(code);
}

const dossier = arg("--dossier");
const write = process.argv.includes("--write");
let cid = arg("--cid");
let existing = null;

if (dossier) {
  let parsed;
  try {
    parsed = parseGbpAnchorFromDossier(dossier);
  } catch (err) {
    emit({ ok: false, place_id: null, error: err.message }, 1);
  }
  existing = parsed.gbp_place_id;
  cid = cid || parsed.gbp_cid;
}

if (isGooglePlaceId(existing)) {
  emit({ ok: true, place_id: existing, source: "dossier", written: false }, 0);
}

const resolved = await resolvePlaceIdFromCid(cid);
if (!resolved.ok) {
  emit({ ok: false, place_id: null, error: resolved.error }, 1);
}

let written = false;
if (write) {
  if (!dossier) emit({ ok: false, place_id: resolved.place_id, error: "write_requires_dossier" }, 1);
  const markdown = fs.readFileSync(dossier, "utf8");
  const stamped = ensurePlaceIdInDossier(markdown, resolved.place_id);
  if (!stamped.gbp_place_id) {
    emit({ ok: false, place_id: null, error: "refused_place_id" }, 1);
  }
  if (stamped.changed) {
    const next = stamped.markdown.endsWith("\n") ? stamped.markdown : `${stamped.markdown}\n`;
    fs.writeFileSync(dossier, next, "utf8");
    written = true;
  }
}

emit(
  {
    ok: true,
    place_id: resolved.place_id,
    title: resolved.title,
    source: "serpapi_data_cid",
    written,
  },
  0
);
