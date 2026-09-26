import assert from "node:assert/strict";
import { test } from "node:test";
import {
  gbpUrlFromSourcesMarkdown,
  keepOwnerPhotoUrl,
  mediaTok,
  parseCidFromUrl,
  parseDataIdLike,
  pickOwnerCategory,
  recordFromPhoto,
  hiResUrl,
} from "../lib/gbp-serpapi.mjs";

await test("keepOwnerPhotoUrl drops Maps chrome, Street View, and geougc posts", () => {
  assert.equal(
    keepOwnerPhotoUrl("https://lh3.googleusercontent.com/gps-cs-s/AHRPTWabc12345678=s1600"),
    true,
  );
  assert.equal(
    keepOwnerPhotoUrl("https://lh3.googleusercontent.com/geougc/AF1QipM38iHGaReX=h400"),
    false,
  );
  assert.equal(
    keepOwnerPhotoUrl("https://streetviewpixels-pa.googleapis.com/v1/thumbnail?panoid=x"),
    false,
  );
  assert.equal(keepOwnerPhotoUrl("https://www.google.com/images/branding/mapslogo.png"), false);
});

await test("mediaTok and hiResUrl normalize lh3 owner stills", () => {
  const u = "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWabc123456789xyz=w456-h240";
  assert.equal(mediaTok(u), "AHRPTWabc123456789xyz");
  assert.equal(hiResUrl(u), "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWabc123456789xyz=s1600");
});

await test("pickOwnerCategory prefers By owner title, else hint", () => {
  const cats = [
    { title: "Latest", id: "CgIgARICGAI" },
    { title: "By owner", id: "CgIgARICEAE" },
  ];
  assert.equal(pickOwnerCategory(cats).id, "CgIgARICEAE");
  assert.equal(pickOwnerCategory([]).title, "By owner");
});

await test("parse cid / data_id / sources.md gbp row", () => {
  assert.equal(parseCidFromUrl("https://www.google.com/maps?cid=8929531730011122168"), "8929531730011122168");
  assert.equal(parseDataIdLike("0x89bac19da78e402b:0x7bec11cc39e469f8"), "0x89bac19da78e402b:0x7bec11cc39e469f8");
  assert.equal(parseDataIdLike("not-an-id"), null);
  const md = `| platform | url | notes |\n|----------|-----|-------|\n| gbp | https://maps.app.goo.gl/abc | Photos → By owner |`;
  assert.equal(gbpUrlFromSourcesMarkdown(md), "https://maps.app.goo.gl/abc");
});

await test("recordFromPhoto sets by_owner and skips geougc", () => {
  const rec = recordFromPhoto(
    { image: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWabc12345678=s44" },
    { sourceUrl: "https://maps.google.com/?cid=1", caption: "Job still" },
  );
  assert.equal(rec.photo_category, "by_owner");
  assert.equal(rec.scraper, "serpapi-google-maps-photos");
  assert.equal(rec.is_gbp_post, false);
  assert.equal(
    recordFromPhoto({ image: "https://lh3.googleusercontent.com/geougc/AF1QipX" }, { sourceUrl: "x" }),
    null,
  );
});
