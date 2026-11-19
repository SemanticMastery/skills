import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { resolveCrawlInputDomain } from './crawl-domain.mjs';

function emptyProject() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'onpage-no-dossier-'));
}

test('--domain and --project-dir with no dossier does not throw', () => {
  const projectDir = emptyProject();
  try {
    const domain = resolveCrawlInputDomain({
      domain: 'example.com',
      projectDir,
      taskId: null,
    });
    assert.equal(domain, 'example.com');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('--project-dir with neither --domain nor a dossier throws', () => {
  const projectDir = emptyProject();
  try {
    assert.throws(
      () => resolveCrawlInputDomain({ domain: null, projectDir, taskId: null }),
      /No \*Dossier\.md/,
    );
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});

test('missing project dir throws', () => {
  const projectDir = path.join(os.tmpdir(), `onpage-missing-${process.pid}`);
  fs.rmSync(projectDir, { recursive: true, force: true });
  assert.throws(
    () =>
      resolveCrawlInputDomain({
        domain: 'example.com',
        projectDir,
        taskId: null,
      }),
    /Project dir not found/,
  );
});

test('--project-dir without --domain still takes the dossier website', () => {
  const projectDir = emptyProject();
  const docs = path.join(projectDir, '01-intake', '1.1-docs');
  fs.mkdirSync(docs, { recursive: true });
  fs.writeFileSync(
    path.join(docs, 'Example-Dossier.md'),
    '**Official Website:** https://example.com/\n',
    'utf8',
  );
  try {
    const domain = resolveCrawlInputDomain({
      domain: null,
      projectDir,
      taskId: null,
    });
    assert.equal(domain, 'example.com');
  } finally {
    fs.rmSync(projectDir, { recursive: true, force: true });
  }
});
