#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  nestCampaignArtifacts,
  resolveArtifact,
} from "../lib/artifacts.mjs";

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

test("brief stays flat when only one file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "art-flat-"));
  const pipe = path.join(root, "06-content-pipeline");
  const brief = path.join(pipe, "03-write", "3.1-brief");
  fs.mkdirSync(brief, { recursive: true });
  fs.writeFileSync(path.join(brief, "post-01-brief.md"), "x");
  nestCampaignArtifacts(pipe, { execute: true });
  assert.equal(fs.existsSync(path.join(brief, "post-01-brief.md")), true);
  assert.equal(fs.existsSync(path.join(brief, "post-01-brief")), false);
  assert.equal(
    resolveArtifact(pipe, "brief", 1),
    path.join(brief, "post-01-brief.md"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("polish and images nest even with one markdown", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "art-bundle-"));
  const pipe = path.join(root, "06-content-pipeline");
  const polish = path.join(pipe, "03-write", "3.4-polish");
  const images = path.join(pipe, "03-write", "3.5-images");
  fs.mkdirSync(polish, { recursive: true });
  fs.mkdirSync(images, { recursive: true });
  fs.writeFileSync(path.join(polish, "post-02-polish.md"), "p");
  fs.writeFileSync(path.join(images, "post-01-images.md"), "i");
  fs.writeFileSync(path.join(images, "post-01-img-01.png"), "png");
  nestCampaignArtifacts(pipe, { execute: true });
  assert.equal(
    fs.existsSync(path.join(polish, "post-02-polish", "post-02-polish.md")),
    true,
  );
  assert.equal(fs.existsSync(path.join(polish, "post-02-polish.md")), false);
  assert.equal(
    fs.existsSync(path.join(images, "post-01-images", "post-01-images.md")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(images, "post-01-images", "post-01-img-01.png")),
    true,
  );
  assert.equal(
    resolveArtifact(pipe, "polish", 2),
    path.join(polish, "post-02-polish", "post-02-polish.md"),
  );
  assert.equal(
    resolveArtifact(pipe, "images", 1),
    path.join(images, "post-01-images", "post-01-images.md"),
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("brief nests when a second artifact appears", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "art-second-"));
  const pipe = path.join(root, "06-content-pipeline");
  const brief = path.join(pipe, "03-write", "3.1-brief");
  fs.mkdirSync(brief, { recursive: true });
  fs.writeFileSync(path.join(brief, "post-01-brief.md"), "a");
  fs.writeFileSync(path.join(brief, "post-01-brief.html"), "b");
  nestCampaignArtifacts(pipe, { execute: true });
  assert.equal(
    fs.existsSync(path.join(brief, "post-01-brief", "post-01-brief.md")),
    true,
  );
  assert.equal(
    fs.existsSync(path.join(brief, "post-01-brief", "post-01-brief.html")),
    true,
  );
  fs.rmSync(root, { recursive: true, force: true });
});

if (process.exitCode) process.exit(process.exitCode);
