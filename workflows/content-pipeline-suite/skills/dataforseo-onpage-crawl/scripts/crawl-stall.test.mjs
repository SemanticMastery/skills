import assert from 'node:assert/strict';
import test from 'node:test';
import { isInProgressZeroCrawl } from './crawl-stall.mjs';

test('in_progress with 0 pages is a stall even when the queue is still full', () => {
  assert.equal(isInProgressZeroCrawl('in_progress', 0), true);
  assert.equal(isInProgressZeroCrawl('in_progress', '0'), true);
  assert.equal(isInProgressZeroCrawl('in_progress', null), true);
});

test('pages already crawled, or a crawl that has not started, is not this stall', () => {
  assert.equal(isInProgressZeroCrawl('in_progress', 1), false);
  assert.equal(isInProgressZeroCrawl('finished', 0), false);
  assert.equal(isInProgressZeroCrawl(null, 0), false);
  assert.equal(isInProgressZeroCrawl('in_progress', 4), false);
});
