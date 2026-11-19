import assert from "node:assert/strict";
import test from "node:test";
import { ensurePlaceIdInDossier } from "../lib/dossier-firmographics.mjs";
import { isGooglePlaceId } from "../lib/place-id.mjs";
import { resolvePlaceIdFromCid } from "../lib/resolve-place-id.mjs";

const PLACE = "ChIJtestPlaceId0000000001";
const CID = "1234567890123456789";

const DOSSIER = `[II] FIRMOGRAPHICS

- **Name:** Example Clinic
- **Address:** 1 Main St, Springfield, IL 62701
- **GBP URL:** https://www.google.com/maps?cid=${CID}
- **GBP CID:** ${CID}

[III] SCOPE OF OPERATIONS
`;

test("isGooglePlaceId accepts ChIJ ids only", () => {
  assert.equal(isGooglePlaceId(PLACE), true);
  assert.equal(isGooglePlaceId(CID), false);
  assert.equal(isGooglePlaceId("EhIJnot-a-gbp-id"), false);
  assert.equal(isGooglePlaceId(""), false);
});

test("ensurePlaceIdInDossier inserts after GBP CID", () => {
  const stamped = ensurePlaceIdInDossier(DOSSIER, PLACE);
  assert.equal(stamped.changed, true);
  assert.equal(stamped.gbp_place_id, PLACE);
  const cidAt = stamped.markdown.indexOf("**GBP CID:**");
  const placeAt = stamped.markdown.indexOf(`**Place ID:** ${PLACE}`);
  assert.ok(cidAt >= 0 && placeAt > cidAt);
  const again = ensurePlaceIdInDossier(stamped.markdown, PLACE);
  assert.equal(again.changed, false);
});

test("ensurePlaceIdInDossier refuses a CID", () => {
  const stamped = ensurePlaceIdInDossier(DOSSIER, CID);
  assert.equal(stamped.changed, false);
  assert.equal(stamped.gbp_place_id, "");
  assert.equal(stamped.markdown.includes("**Place ID:**"), false);
});

test("resolvePlaceIdFromCid reads place_results and hides the key", async () => {
  let seen = "";
  const fetchImpl = async (url) => {
    seen = String(url);
    return {
      ok: true,
      status: 200,
      json: async () => ({
        place_results: { title: "Example Clinic", place_id: PLACE, data_cid: CID },
      }),
    };
  };
  const resolved = await resolvePlaceIdFromCid(CID, { fetchImpl, apiKey: "test-key" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.place_id, PLACE);
  assert.equal(resolved.title, "Example Clinic");
  assert.equal(seen.includes("data_cid=" + CID), true);
  assert.equal(seen.includes("test-key"), true);
  assert.equal(JSON.stringify(resolved).includes("test-key"), false);
});

test("resolvePlaceIdFromCid rejects a missing key and a bad id", async () => {
  const missing = await resolvePlaceIdFromCid(CID, { apiKey: "" });
  assert.equal(missing.ok, false);
  assert.equal(missing.error, "missing_serpapi_key");
  const bad = await resolvePlaceIdFromCid("12", { apiKey: "test-key" });
  assert.equal(bad.ok, false);
  assert.equal(bad.error, "invalid_cid");
});
