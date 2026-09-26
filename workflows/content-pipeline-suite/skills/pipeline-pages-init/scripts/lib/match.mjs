const STOP = new Set(["and", "or", "the", "a", "an", "of", "for", "to", "with"]);

const PHRASE_SYNONYMS = [
  ["emergency service", "emergency storm response"],
  ["emergency-service", "emergency storm response"],
  ["tree trimming", "trimming and pruning"],
];

const TOKEN_SYNONYMS = {
  trimming: ["pruning"],
  pruning: ["trimming"],
};

export function slugify(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((t) => t && !STOP.has(t));
}

export function expandTokens(source) {
  const set = new Set(tokens(source));
  const joined = Array.from(set).join(" ");
  const slug = slugify(source);
  for (const [a, b] of PHRASE_SYNONYMS) {
    if (slug === slugify(a) || joined.includes(a) || source.toLowerCase().includes(a)) {
      for (const t of tokens(b)) set.add(t);
    }
    if (slug === slugify(b) || joined.includes(b) || source.toLowerCase().includes(b)) {
      for (const t of tokens(a)) set.add(t);
    }
  }
  for (const t of [...set]) {
    for (const syn of TOKEN_SYNONYMS[t] || []) set.add(syn);
  }
  return set;
}

function score(slug, offering) {
  if (slugify(offering) === slug) return 1;
  const a = expandTokens(slug);
  const b = expandTokens(offering);
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = new Set([...a, ...b]).size;
  if (!union) return 0;
  const jaccard = inter / union;
  if (inter >= 2) return Math.max(jaccard, 0.51);
  return jaccard;
}

export function matchPages(crawlPages, offerings) {
  const usedOfferings = new Set();
  const both = [];
  const crawlOnly = [];

  for (const page of crawlPages) {
    let best = null;
    let bestScore = 0;
    for (const offering of offerings) {
      if (usedOfferings.has(offering)) continue;
      const s = score(page.slug, offering);
      if (s > bestScore) {
        bestScore = s;
        best = offering;
      }
    }
    if (best && bestScore >= 0.45) {
      usedOfferings.add(best);
      both.push({
        slug: page.slug,
        url: page.url,
        offering: best,
        source: "both",
        meta_title: page.meta_title,
        h1_headings: page.h1_headings,
        word_count: page.word_count,
      });
    } else {
      crawlOnly.push({
        slug: page.slug,
        url: page.url,
        offering: null,
        source: "crawl",
        meta_title: page.meta_title,
        h1_headings: page.h1_headings,
        word_count: page.word_count,
      });
    }
  }

  const catalogOnly = offerings
    .filter((o) => !usedOfferings.has(o))
    .map((offering) => ({
      slug: slugify(offering),
      url: null,
      offering,
      source: "catalog",
    }));

  return { both, crawlOnly, catalogOnly };
}
