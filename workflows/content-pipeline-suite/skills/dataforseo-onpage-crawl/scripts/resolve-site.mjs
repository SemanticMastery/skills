/**
 * Resolve live hostname + sitemap host alignment before OnPage task_post.
 *
 * Also probes whether the site needs enable_javascript on task_post (SPA / empty
 * plain HTML). See docs/solutions/onpage-js-and-stall-fix.md (DeForest 2026-06).
 */

const JS_PLAIN_TEXT_WORD_THRESHOLD = 100;
const JS_SHELL_MARKERS =
  /__NEXT_DATA__|id=["'](?:root|app|__next)["']|ng-version|data-reactroot|nuxt|gatsby|webpackJsonp/i;

/** Common sitemap / sitemap-index paths (Yoast, RankMath, WP, generic). */
const SITEMAP_PATHS = [
  '/sitemaps.xml',
  '/sitemap_index.xml',
  '/sitemap-index.xml',
  '/sitemap.xml',
  '/wp-sitemap.xml',
];

export function normalizeHost(raw) {
  if (!raw) return null;
  let d = String(raw).trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  d = d.split('/')[0];
  return d || null;
}

/** Follow redirects (manual) to the hostname users/bots actually land on. */
export async function resolveLiveHostname(host) {
  const variants = [host];
  if (!/^www\./i.test(host)) variants.push(`www.${host}`);
  for (const h of variants) {
    let url = `https://${h}/`;
    for (let hop = 0; hop < 10; hop++) {
      const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get('location');
        if (!loc) break;
        url = new URL(loc, url).href;
        continue;
      }
      if (res.status >= 200 && res.status < 300) {
        return new URL(url).hostname;
      }
      break;
    }
  }
  return host;
}

function hostVariants(host) {
  const apex = host.replace(/^www\./i, '');
  const www = /^www\./i.test(host) ? host : `www.${host}`;
  return [...new Set([host, apex, www])];
}

/** Parse `Sitemap:` lines from robots.txt. */
export function parseRobotsSitemapUrls(robotsText) {
  if (!robotsText) return [];
  const urls = [];
  for (const line of String(robotsText).split(/\r?\n/)) {
    const m = line.match(/^\s*Sitemap:\s*(\S+)/i);
    if (m?.[1]) urls.push(m[1].trim());
  }
  return [...new Set(urls)];
}

async function fetchRobotsSitemapUrls(host) {
  const urls = [];
  for (const h of hostVariants(host)) {
    try {
      const res = await fetch(`https://${h}/robots.txt`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) continue;
      urls.push(...parseRobotsSitemapUrls(await res.text()));
    } catch {
      /* try next host */
    }
  }
  return [...new Set(urls)];
}

/**
 * Discover sitemap or sitemap index XML.
 * Tries robots.txt Sitemap: first, then common path slugs on apex/www.
 */
export async function fetchSitemapXml(host) {
  const fromRobots = await fetchRobotsSitemapUrls(host);
  const pathCandidates = [];
  for (const h of hostVariants(host)) {
    for (const p of SITEMAP_PATHS) {
      pathCandidates.push(`https://${h}${p}`);
    }
  }
  const candidates = [...fromRobots, ...pathCandidates];
  const seen = new Set();

  for (const url of candidates) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) continue;
      const finalUrl = res.url || url;
      return { url: finalUrl, requestedUrl: url, text };
    } catch {
      /* try next */
    }
  }
  return null;
}

export function parseSitemapLocs(xml) {
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
  const hosts = {};
  for (const loc of locs) {
    try {
      const h = new URL(loc).hostname.toLowerCase();
      hosts[h] = (hosts[h] || 0) + 1;
    } catch {
      /* skip */
    }
  }
  return { locs, hosts };
}

export function isSitemapIndex(xml) {
  return /<sitemapindex/i.test(xml);
}

export async function fetchSitemapXmlByUrl(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.includes('<urlset') && !text.includes('<sitemapindex')) return null;
  return { url, text };
}

/** Expand sitemap indexes into page URLs (e.g. sitemaps.xml → post-sitemap1.xml → N URLs). */
export async function expandSitemapPageLocs(rootSm) {
  const top = parseSitemapLocs(rootSm.text);
  if (!isSitemapIndex(rootSm.text)) {
    return {
      locs: top.locs.filter((loc) => !/\.xml(\?|$)/i.test(loc)),
      hosts: top.hosts,
      indexChildCount: 0,
      childSitemapUrls: [],
    };
  }

  const pageLocs = [];
  const hosts = {};
  const childSitemapUrls = [...top.locs];
  for (const childUrl of top.locs) {
    try {
      const child = await fetchSitemapXmlByUrl(childUrl);
      if (!child) continue;
      if (isSitemapIndex(child.text)) {
        const nested = await expandSitemapPageLocs(child);
        pageLocs.push(...nested.locs);
        childSitemapUrls.push(...(nested.childSitemapUrls || []));
        for (const [h, count] of Object.entries(nested.hosts)) {
          hosts[h] = (hosts[h] || 0) + count;
        }
        continue;
      }
      const parsed = parseSitemapLocs(child.text);
      for (const loc of parsed.locs) {
        if (!/\.xml(\?|$)/i.test(loc)) pageLocs.push(loc);
      }
      for (const [h, count] of Object.entries(parsed.hosts)) {
        hosts[h] = (hosts[h] || 0) + count;
      }
    } catch {
      /* skip child sitemap */
    }
  }

  return {
    locs: [...new Set(pageLocs)],
    hosts,
    indexChildCount: top.locs.length,
    childSitemapUrls: [...new Set(childSitemapUrls)],
  };
}

function predominantHost(hostCounts) {
  const entries = Object.entries(hostCounts);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

export function plainTextWordCount(html) {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped ? stripped.split(' ').filter(Boolean).length : 0;
}

/** Fetch without JS; low visible text ⇒ task_post needs enable_javascript. */
export async function probeJavascriptRequired(pageUrl) {
  const res = await fetch(pageUrl, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20000),
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    },
  });
  const html = await res.text();
  const plainTextWords = plainTextWordCount(html);
  const shellMarkers = JS_SHELL_MARKERS.test(html);
  const jsRequired =
    plainTextWords < JS_PLAIN_TEXT_WORD_THRESHOLD ||
    (shellMarkers && plainTextWords < 250);
  return { jsRequired, plainTextWords, probeUrl: pageUrl, shellMarkers };
}

function apexHost(host) {
  return host.replace(/^www\./i, '');
}

/**
 * @param {string} inputDomain bare host from user/cli
 * @param {{ dossierWebsite?: string|null }} opts
 */
export async function planCrawlTarget(inputDomain, opts = {}) {
  const warnings = [];
  const inputHost = normalizeHost(inputDomain);
  if (!inputHost) throw new Error('Invalid domain');

  let dossierHost = null;
  if (opts.dossierWebsite) {
    dossierHost = normalizeHost(opts.dossierWebsite);
    if (dossierHost && dossierHost !== inputHost) {
      warnings.push(`dossier host ${dossierHost} differs from input ${inputHost}; using live + sitemap resolution`);
    }
  }

  const liveHost = await resolveLiveHostname(dossierHost || inputHost);
  let crawlTarget = liveHost;

  const sm = await fetchSitemapXml(crawlTarget);
  let sitemapUrl = null;
  let sitemapUrlCount = 0;
  let sitemapPredominantHost = null;

  let sitemapLocs = [];
  let sitemapChildUrls = [];
  if (sm) {
    sitemapUrl = sm.url;
    const expanded = await expandSitemapPageLocs(sm);
    sitemapLocs = expanded.locs;
    sitemapUrlCount = sitemapLocs.length;
    sitemapChildUrls = expanded.childSitemapUrls || [];
    sitemapPredominantHost = predominantHost(expanded.hosts);
    if (expanded.indexChildCount > 0) {
      warnings.push(
        `sitemap index ${sitemapUrl} has ${expanded.indexChildCount} child sitemap(s); expanded to ${sitemapUrlCount} page URL(s)`
      );
      for (const child of sitemapChildUrls.slice(0, 12)) {
        warnings.push(`sitemap_child=${child}`);
      }
      if (sitemapChildUrls.length > 12) {
        warnings.push(`sitemap_child=… +${sitemapChildUrls.length - 12} more`);
      }
    }
    if (sitemapPredominantHost && sitemapPredominantHost !== crawlTarget.toLowerCase()) {
      warnings.push(
        `sitemap host ${sitemapPredominantHost} ≠ live host ${crawlTarget}; aligning target to sitemap`
      );
      crawlTarget = sitemapPredominantHost;
    }
  } else {
    warnings.push(
      `no sitemap/index found for ${crawlTarget} (tried robots.txt + /sitemaps.xml, /sitemap_index.xml, /sitemap.xml, …); using live host only`
    );
  }

  let jsProbe = null;
  let jsRequiredRecommended = false;
  const probeUrls =
    sitemapLocs.length > 1
      ? [...new Set([sitemapLocs[1], sitemapLocs[0], sitemapLocs[2]].filter(Boolean))].slice(0, 3)
      : [sitemapLocs[0] ?? `https://${crawlTarget}/`];
  try {
    const probes = [];
    for (const probeUrl of probeUrls) {
      probes.push(await probeJavascriptRequired(probeUrl));
    }
    jsProbe = probes.reduce((min, p) => (p.plainTextWords < min.plainTextWords ? p : min), probes[0]);
    jsRequiredRecommended = probes.some((p) => p.jsRequired);
    if (jsRequiredRecommended) {
      warnings.push(
        `JS-rendered content detected (min plain_text_words=${jsProbe.plainTextWords} across ${probes.length} probe URL(s)); will auto-enable enable_javascript on task_post`
      );
      const apex = apexHost(inputHost);
      if (apex !== crawlTarget) {
        warnings.push(`JS site: task target ${crawlTarget} → apex ${apex} (DataForSEO guidance)`);
        crawlTarget = apex;
      }
    }
  } catch (err) {
    warnings.push(`JS probe skipped: ${err.message}`);
  }

  const canonicalUrl = `https://${crawlTarget}/`;
  // Prefer sitemap-only whenever a sitemap exists (service/storefront): crawl what
  // sitemaps explicitly list. Avoids unbounded link-queue balloons (Greater Life).
  // JS-required sites still spider with respect_sitemap for orphans.
  const crawlSitemapOnly =
    sitemapUrlCount > 0 && !jsRequiredRecommended;
  // No soft 500 cap for known sitemap budgets — service sites get full sitemap + headroom.
  const maxCrawlPagesSuggested =
    sitemapUrlCount > 0 ? sitemapUrlCount + 10 : 500;
  const minPagesSuggested =
    sitemapUrlCount > 0 ? Math.max(2, Math.floor(sitemapUrlCount * 0.6)) : 2;

  return {
    inputHost,
    dossierHost,
    liveHost,
    crawlTarget,
    canonicalUrl,
    sitemapUrl,
    sitemapUrlCount,
    sitemapLocs,
    sitemapChildUrls,
    sitemapPredominantHost,
    crawlSitemapOnly,
    jsRequiredRecommended,
    jsProbe,
    maxCrawlPagesSuggested,
    minPagesSuggested,
    warnings,
  };
}
