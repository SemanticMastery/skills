const CITATION_RE = /\[PD-SRC-[0-9A-Z]+\]/gi;

export const METHOD_VERBS = [
  "inject",
  "apply",
  "prune",
  "grind",
  "treat",
  "fertilize",
  "spray",
  "cut",
  "remove",
  "climb",
  "chip",
  "stump",
  "cable",
  "brace",
  "plant",
  "water",
];

export const CREDENTIALS = ["ISA", "TCIA", "BBB", "LLC", "CPA", "CTSP", "OSHA"];

export const PRODUCT_NOUNS = [
  "fungicide",
  "insecticide",
  "herbicide",
  "fertilizer",
  "alamo",
  "propiconazole",
  "macropore",
];

const NUMBER_ONES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
};

const NUMBER_TENS = {
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

const STOP = new Set([
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "of",
  "to",
  "for",
  "and",
  "or",
  "we",
  "i",
  "you",
  "they",
  "is",
  "are",
  "was",
  "be",
  "by",
  "with",
  "from",
  "as",
  "that",
  "this",
  "it",
  "not",
  "typical",
  "job",
  "saws",
  "saw",
  "certified",
  "arborist",
  "product",
  "spring",
  "depends",
  "yes",
  "no",
]);

function stripCitations(text) {
  return String(text ?? "").replace(CITATION_RE, " ");
}

function lemmaVerb(word) {
  const lower = word.toLowerCase();
  if (METHOD_VERBS.includes(lower)) return lower;
  for (const stem of METHOD_VERBS) {
    if (lower === `${stem}s` || lower === `${stem}ed` || lower === `${stem}ing`) return stem;
    if (stem.endsWith("e") && lower === `${stem.slice(0, -1)}ing`) return stem;
  }
  return null;
}

function replaceNumberWords(text) {
  let out = ` ${text} `;
  out = out.replace(/\btwelve hundred\b/g, " 1200 ");
  out = out.replace(/\bone hundred fifty\b/g, " 150 ");
  out = out.replace(/\b(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)[\s-]+(one|two|three|four|five|six|seven|eight|nine)\b/g, (_, tens, ones) => {
    return ` ${NUMBER_TENS[tens] + NUMBER_ONES[ones]} `;
  });
  out = out.replace(/\b(one|two|three|four|five|six|seven|eight|nine)\s+hundred\b/g, (_, ones) => {
    return ` ${NUMBER_ONES[ones] * 100} `;
  });
  for (const [word, value] of Object.entries({ ...NUMBER_TENS, ...NUMBER_ONES, hundred: 100, thousand: 1000 })) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "g"), ` ${value} `);
  }
  return out.replace(/\s+/g, " ").trim();
}

export function normalize(text) {
  let out = stripCitations(text).toLowerCase();
  out = out.replace(/[$€£¥₹]/g, " dollars ");
  out = out.replace(/(\d),(\d{3})/g, "$1$2");
  out = out.replace(/['’]s\b/g, "");
  out = out.replace(/['’]/g, "");
  out = replaceNumberWords(out);
  out = out.replace(/[^a-z0-9.%/\s-]+/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

function brandKey(word) {
  return String(word || "")
    .toLowerCase()
    .replace(/['’]s$/i, "")
    .replace(/s$/i, "");
}

function extractCapitalizedNames(original) {
  const cleaned = stripCitations(original);
  const names = [];
  const re = /\b[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)+\b/g;
  let match;
  while ((match = re.exec(cleaned))) {
    names.push(match[0]);
  }
  const singles = cleaned.match(/\b[A-Z][A-Za-z]{2,}\b/g) || [];
  for (const word of singles) {
    if (CREDENTIALS.includes(word.toUpperCase())) continue;
    if (STOP.has(word.toLowerCase())) continue;
    names.push(word);
  }
  return names;
}

export function extractTokens(text) {
  const original = String(text ?? "");
  const stripped = stripCitations(original);
  const normalized = normalize(stripped);
  const tokens = new Set();

  for (const cred of CREDENTIALS) {
    if (new RegExp(`\\b${cred}\\b`, "i").test(stripped)) {
      tokens.add(cred.toLowerCase());
    }
  }

  for (const noun of PRODUCT_NOUNS) {
    if (new RegExp(`\\b${noun}\\b`, "i").test(normalized)) tokens.add(noun);
  }

  for (const word of stripped.split(/[^\p{L}\p{N}]+/u).filter(Boolean)) {
    const lemma = lemmaVerb(word);
    if (lemma) tokens.add(lemma);
  }

  for (const num of normalized.match(/\b\d+(?:\.\d+)?\b/g) || []) {
    tokens.add(num);
  }
  if (/%/.test(normalized) || /\bpercent\b/.test(normalized)) {
    for (const row of normalized.match(/\b\d+(?:\.\d+)?\s*%/g) || []) {
      tokens.add(row.replace(/\s+/g, ""));
    }
  }
  if (/dollars/.test(normalized)) {
    for (const row of normalized.match(/\b\d+(?:\.\d+)?\s+dollars\b/g) || []) {
      tokens.add(row.replace(/\s+/g, " "));
    }
  }

  for (const name of extractCapitalizedNames(stripped)) {
    const first = name.split(/\s+/)[0];
    if (CREDENTIALS.includes(first.toUpperCase())) continue;
    tokens.add(brandKey(name.replace(/\s+/g, " ")));
  }

  const crew = stripped.match(/\bcrew of\s+(\d+)\b/i);
  if (crew) tokens.add(crew[1]);

  return [...tokens].sort();
}

function ownerHasToken(ownerNorm, token) {
  const needle = brandKey(token);
  const ownerBrand = ` ${ownerNorm.split(/\s+/).map(brandKey).join(" ")} `;
  if (token.includes(" ")) {
    const parts = token.split(/\s+/).filter((part) => !STOP.has(part));
    for (let i = 0; i < parts.length - 1; i++) {
      const bigram = `${parts[i]} ${parts[i + 1]}`;
      if (ownerNorm.includes(bigram) || ownerBrand.includes(` ${brandKey(parts[i])} ${brandKey(parts[i + 1])} `)) {
        return true;
      }
    }
  }
  if (new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(ownerNorm)) return true;
  if (ownerBrand.includes(` ${needle} `)) return true;
  return false;
}

export function groundFact(factText, ownerWords) {
  const tokens = extractTokens(factText);
  const ownerEmpty = !String(ownerWords ?? "").trim();
  if (ownerEmpty) {
    return tokens.length ? { reason: "transcript_unavailable", tokens } : null;
  }
  const ownerNorm = normalize(ownerWords);
  const missing = tokens.filter((token) => !ownerHasToken(ownerNorm, token));
  if (!missing.length) return null;
  return { reason: "ungrounded", tokens: missing };
}
