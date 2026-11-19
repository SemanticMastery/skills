import assert from 'node:assert/strict';
import test from 'node:test';
import { coverRedirectedSitemapLocs, decideDeliverableWrite } from './crawl-domain.mjs';

test('a sitemap loc that redirects to a crawled URL is covered once', () => {
  const rows = [{ url: 'https://www.example.com/service', meta_title: 'Service' }];
  const applied = coverRedirectedSitemapLocs(
    rows,
    ['https://www.example.com/services'],
    [
      {
        loc: 'https://www.example.com/services',
        url: 'https://www.example.com/service',
        row: { url: 'https://www.example.com/service', meta_title: 'Service' },
      },
    ],
  );
  assert.equal(applied.missing.length, 0);
  assert.equal(applied.rows.length, 1);
});

test('a redirect target that was not already crawled is kept under its final URL', () => {
  const applied = coverRedirectedSitemapLocs(
    [],
    ['https://www.example.com/services'],
    [
      {
        loc: 'https://www.example.com/services',
        url: 'https://www.example.com/service',
        row: { url: 'https://www.example.com/service' },
      },
    ],
  );
  assert.equal(applied.missing.length, 0);
  assert.deepEqual(
    applied.rows.map((row) => row.url),
    ['https://www.example.com/service'],
  );
});

test('www and trailing slash already match without a fill', () => {
  const applied = coverRedirectedSitemapLocs(
    [{ url: 'https://example.com/services/' }],
    ['https://www.example.com/services'],
    [],
  );
  assert.equal(applied.missing.length, 0);
  assert.equal(applied.rows.length, 1);
});

test('redirects that share a row still write when unique HTML is under the sitemap count', () => {
  const gate = decideDeliverableWrite({
    rowCount: 37,
    minPages: 40,
    sitemapLocCount: 40,
    missingCount: 0,
  });
  assert.equal(gate.write, true);
  assert.equal(gate.reason, 'redirects_share_rows');
});

test('unresolved sitemap locs still write and are not a discard', () => {
  const gate = decideDeliverableWrite({
    rowCount: 37,
    minPages: 40,
    sitemapLocCount: 40,
    missingCount: 3,
  });
  assert.equal(gate.write, true);
  assert.equal(gate.reason, 'sitemap_gap');
});

test('zero HTML rows do not write', () => {
  const gate = decideDeliverableWrite({
    rowCount: 0,
    minPages: 40,
    sitemapLocCount: 40,
    missingCount: 40,
  });
  assert.equal(gate.write, false);
  assert.equal(gate.reason, 'no_rows');
});

test('a short crawl with no sitemap does not write', () => {
  const gate = decideDeliverableWrite({
    rowCount: 1,
    minPages: 2,
    sitemapLocCount: 0,
    missingCount: 0,
  });
  assert.equal(gate.write, false);
  assert.equal(gate.reason, 'below_min');
});

test('an unfetched missing loc stays missing', () => {
  const applied = coverRedirectedSitemapLocs(
    [{ url: 'https://www.example.com/about' }],
    ['https://www.example.com/services'],
    [],
  );
  assert.deepEqual(applied.missing, ['https://www.example.com/services']);
});
