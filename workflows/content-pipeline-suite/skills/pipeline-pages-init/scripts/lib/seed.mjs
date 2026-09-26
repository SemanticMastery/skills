const TERMINAL = new Set([
  "service",
  "services",
  "treatment",
  "response",
  "plan",
  "plans",
]);

export function wordsFromSlug(slug) {
  return String(slug || "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function commercialSeed({ slug, offering, source }) {
  const base =
    source === "catalog" || !slug
      ? String(offering || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase()
      : wordsFromSlug(slug);
  if (!base) return "";
  const parts = base.split(" ");
  const last = parts[parts.length - 1];
  if (TERMINAL.has(last)) return base;
  return `${base} service`;
}
