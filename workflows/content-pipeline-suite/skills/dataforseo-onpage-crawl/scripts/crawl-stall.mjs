/**
 * A crawl that has started and still has 0 pages fetched is stalled.
 * pages_in_queue is intentionally not an input.
 *
 * Good Day Garage Doors, 2026-11-14: 59 polls over 898s were
 * in_progress, pages_crawled=0, pages_in_queue=1. The old gate required
 * an empty queue, so the 3-minute force_stop never ran and the wait
 * used the full 15-minute deadline.
 */
export function isInProgressZeroCrawl(progress, pagesCrawled) {
  if (progress !== 'in_progress') return false;
  if (pagesCrawled == null || pagesCrawled === '') return true;
  const n = typeof pagesCrawled === 'number' ? pagesCrawled : Number(pagesCrawled);
  return Number.isFinite(n) && n === 0;
}
