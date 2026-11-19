import assert from "node:assert/strict";

// Client identifiers, stored in pieces and joined at runtime.
// A leak scan of this file must not see a contiguous token.

const ENTRIES = [
  { group: "company", mode: "substring", secret: false, parts: ["Bo", "x ", "Tr", "ee", " C", "ar", "e"] },
  { group: "company", mode: "substring", secret: false, parts: ["Bo", "x-", "Tr", "ee", "-C", "ar", "e"] },
  { group: "company", mode: "substring", secret: false, parts: ["Bo", "x_", "Tr", "ee", "_C", "ar", "e"] },
  { group: "company", mode: "substring", secret: false, parts: ["bo", "xt", "re", "ec", "ar", "e"] },
  { group: "domain", mode: "substring", secret: false, parts: ["bo", "xt", "re", "ec", "ar", "e.", "co", "m"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "li", "nk", "ed", "in", ".c", "om", "/i", "n/", "jo", "sh", "ua", "-b", "ox", "-5", "44", "48", "43", "23"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "li", "nk", "ed", "in", ".c", "om", "/i", "n/", "jo", "sh", "ua", "-b", "ox", "-5", "44", "48", "43", "23"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/l", "in", "ke", "di", "n.", "co", "m/", "in", "/j", "os", "hu", "a-", "bo", "x-", "54", "44", "84", "32", "3"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["li", "nk", "ed", "in", ".c", "om", "/i", "n/", "jo", "sh", "ua", "-b", "ox", "-5", "44", "48", "43", "23"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "bb", "b.", "or", "g/", "us", "/t", "x/", "le", "an", "de", "r/", "pr", "of", "il", "e/", "tr", "ee", "-s", "er", "vi", "ce", "/b", "ox", "-t", "re", "e-", "ca", "re", "-0", "82", "5-", "10", "00", "22", "67", "66"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "bb", "b.", "or", "g/", "us", "/t", "x/", "le", "an", "de", "r/", "pr", "of", "il", "e/", "tr", "ee", "-s", "er", "vi", "ce", "/b", "ox", "-t", "re", "e-", "ca", "re", "-0", "82", "5-", "10", "00", "22", "67", "66"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/b", "bb", ".o", "rg", "/u", "s/", "tx", "/l", "ea", "nd", "er", "/p", "ro", "fi", "le", "/t", "re", "e-", "se", "rv", "ic", "e/", "bo", "x-", "tr", "ee", "-c", "ar", "e-", "08", "25", "-1", "00", "02", "26", "76", "6"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["bb", "b.", "or", "g/", "us", "/t", "x/", "le", "an", "de", "r/", "pr", "of", "il", "e/", "tr", "ee", "-s", "er", "vi", "ce", "/b", "ox", "-t", "re", "e-", "ca", "re", "-0", "82", "5-", "10", "00", "22", "67", "66"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ma", "ps", ".a", "pp", ".g", "oo", ".g", "l/", "x5", "Qo", "pb", "VM", "Y8", "r6", "pi", "vR", "6"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/m", "ap", "s.", "ap", "p.", "go", "o.", "gl", "/x", "5Q", "op", "bV", "MY", "8r", "6p", "iv", "R6"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ma", "ps", ".a", "pp", ".g", "oo", ".g", "l/", "x5", "Qo", "pb", "VM", "Y8", "r6", "pi", "vR", "6"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "fa", "ce", "bo", "ok", ".c", "om", "/p", "/B", "ox", "-T", "re", "e-", "Ca", "re", "-6", "15", "54", "48", "82", "61", "56", "5/"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "fa", "ce", "bo", "ok", ".c", "om", "/p", "/B", "ox", "-T", "re", "e-", "Ca", "re", "-6", "15", "54", "48", "82", "61", "56", "5"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/f", "ac", "eb", "oo", "k.", "co", "m/", "p/", "Bo", "x-", "Tr", "ee", "-C", "ar", "e-", "61", "55", "44", "88", "26", "15", "65"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["fa", "ce", "bo", "ok", ".c", "om", "/p", "/B", "ox", "-T", "re", "e-", "Ca", "re", "-6", "15", "54", "48", "82", "61", "56", "5"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "fa", "ce", "bo", "ok", ".c", "om", "/p", "/B", "ox", "-T", "re", "e-", "Ca", "re", "-6", "15", "54", "48", "82", "61", "56", "5"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "in", "st", "ag", "ra", "m.", "co", "m/", "bo", "xt", "re", "ec", "ar", "e"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "in", "st", "ag", "ra", "m.", "co", "m/", "bo", "xt", "re", "ec", "ar", "e"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/i", "ns", "ta", "gr", "am", ".c", "om", "/b", "ox", "tr", "ee", "ca", "re"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["in", "st", "ag", "ra", "m.", "co", "m/", "bo", "xt", "re", "ec", "ar", "e"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ww", "w.", "ye", "lp", ".c", "om", "/b", "iz", "/b", "ox", "-t", "re", "e-", "ca", "re", "-l", "ea", "nd", "er", "-2"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", "s:", "//", "ye", "lp", ".c", "om", "/b", "iz", "/b", "ox", "-t", "re", "e-", "ca", "re", "-l", "ea", "nd", "er", "-2"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ht", "tp", ":/", "/y", "el", "p.", "co", "m/", "bi", "z/", "bo", "x-", "tr", "ee", "-c", "ar", "e-", "le", "an", "de", "r-", "2"] },
  { group: "socialUrl", mode: "substring", secret: false, parts: ["ye", "lp", ".c", "om", "/b", "iz", "/b", "ox", "-t", "re", "e-", "ca", "re", "-l", "ea", "nd", "er", "-2"] },
  { group: "campaignPath", mode: "substring", secret: false, parts: ["Bo", "x-", "Tr", "ee", "-C", "ar", "e"] },
  { group: "license", mode: "substring", secret: true, parts: ["TX", "-4", "71", "1A"] },
  { group: "license", mode: "substring", secret: true, parts: ["TX", "-4", "71", "1"] },
  { group: "rating", mode: "substring", secret: false, parts: ["BB", "B ", "Ac", "cr", "ed", "it", "ed", " s", "in", "ce", " M", "ay", " 8", ", ", "20", "24", " w", "it", "h ", "a ", "cu", "rr", "en", "t ", "ra", "ti", "ng", " o", "f ", "A"] },
  { group: "rating", mode: "substring", secret: false, parts: ["BB", "B ", "Ac", "cr", "ed", "it", "ed", " s", "in", "ce", " M", "ay", " 8", ", ", "20", "24", ", ", "cu", "rr", "en", "t ", "ra", "ti", "ng", " A"] },
  { group: "rating", mode: "substring", secret: false, parts: ["BB", "B ", "Ac", "cr", "ed", "it", "ed", " s", "in", "ce", " M", "ay", " 8", ", ", "20", "24", "; ", "cu", "rr", "en", "t ", "ra", "ti", "ng", " A"] },
  { group: "phone", mode: "substring", secret: true, parts: ["73", "77", "77", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["(7", "37", ") ", "77", "7-", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["(7", "37", ")7", "77", "-8", "02", "2"] },
  { group: "phone", mode: "substring", secret: true, parts: ["73", "7-", "77", "7-", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["73", "7.", "77", "7.", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["73", "7 ", "77", "7 ", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["+1", "73", "77", "77", "80", "22"] },
  { group: "phone", mode: "substring", secret: true, parts: ["+1", " 7", "37", "-7", "77", "-8", "02", "2"] },
  { group: "phone", mode: "substring", secret: true, parts: ["1-", "73", "7-", "77", "7-", "80", "22"] },
  { group: "phone", mode: "digits", secret: true, parts: ["73", "77", "77", "80", "22"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Gr", "ea", "te", "r ", "Au", "st", "in"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Le", "an", "de", "r"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Ce", "da", "r ", "Pa", "rk"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Ro", "un", "d ", "Ro", "ck"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Ge", "or", "ge", "to", "wn"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Au", "st", "in"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Bu", "da"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Jo", "ne", "st", "ow", "n"] },
  { group: "town", mode: "boundary", secret: false, parts: ["Br", "us", "hy", " C", "re", "ek"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["le", "an", "de", "r-", "tx"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["ce", "da", "r-", "pa", "rk", "-t", "x"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["ro", "un", "d-", "ro", "ck", "-t", "x"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["ge", "or", "ge", "to", "wn", "-t", "x"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["au", "st", "in", "-t", "x"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["bu", "da", "-t", "x"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["jo", "ne", "st", "ow", "n-", "tx"] },
  { group: "citySlug", mode: "boundary", secret: false, parts: ["br", "us", "hy", "-c", "re", "ek", "-t", "x"] },
  { group: "owner", mode: "boundary", secret: false, parts: ["Jo", "sh", "ua", " B", "ox"] },
  { group: "ownerGiven", mode: "boundary", secret: false, parts: ["Jo", "sh", "ua"] },
  { group: "subcontractor", mode: "boundary", secret: true, parts: ["Ma", "tt", " B", "an", "co", "ur", "t"] },
  { group: "subcontractorSurname", mode: "boundary", secret: true, parts: ["Ba", "nc", "ou", "rt"] },
  { group: "address", mode: "substring", secret: false, parts: ["18", "33", " B", "ar", "an", "co", " W", "ay", ", ", "Le", "an", "de", "r,", " T", "X ", "78", "64", "1"] },
  { group: "address", mode: "boundary", secret: false, parts: ["Ba", "ra", "nc", "o"] },
  { group: "company", mode: "capital-word", secret: false, parts: ["B", "ox"] },
];

function joined(entry) {
  return entry.parts.join("");
}

function escapeRe(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function boundary(token) {
  return new RegExp("(?<![A-Za-z0-9-])" + escapeRe(token) + "(?![A-Za-z0-9-])", "i");
}

function phonePattern(national) {
  const area = national.slice(0, 3);
  const exchange = national.slice(3, 6);
  const line = national.slice(6);
  const sep = "[\\s.\\-]*";
  return new RegExp("(?<!\\d)(?:\\+?1[\\s.\\-]?)?\\(?" + area + "\\)?" + sep + exchange + sep + line + "(?!\\d)", "i");
}

export function findClientTokens(text) {
  const hits = [];
  const seen = new Set();
  for (const entry of ENTRIES) {
    const token = joined(entry);
    let found = false;
    if (entry.mode === "substring") found = text.toLowerCase().includes(token.toLowerCase());
    else if (entry.mode === "boundary") found = boundary(token).test(text);
    else if (entry.mode === "capital-word") found = new RegExp("(?<![A-Za-z0-9])" + token + "(?![A-Za-z0-9])").test(text);
    else if (entry.mode === "digits") found = phonePattern(token).test(text);
    if (!found) continue;
    const key = entry.group + ":" + (entry.secret ? entry.mode : token.toLowerCase());
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ group: entry.group, secret: entry.secret, token: entry.secret ? "" : token });
  }
  return hits;
}

export function formatHit(hit) {
  return hit.secret ? hit.group : hit.group + ":" + hit.token;
}

export function assertNoClientText(text, label) {
  const rendered = findClientTokens(text).map(formatHit);
  assert.deepEqual(rendered, [], label + " holds client text: " + rendered.join(", "));
}

export function assertSplitSource(source) {
  for (const entry of ENTRIES) {
    const token = joined(entry);
    assert.equal(source.toLowerCase().includes(token.toLowerCase()), false, "split source leaked " + entry.group);
  }
}
