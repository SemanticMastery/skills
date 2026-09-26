import fs from "node:fs";
import path from "node:path";

export function findProductDoc(resourcesDir) {
  if (!fs.existsSync(resourcesDir)) return null;
  const direct = path.join(resourcesDir, "Product-Documentation.md");
  if (fs.existsSync(direct)) return direct;
  const stack = [resourcesDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) stack.push(abs);
      else if (/product-documentation\.md$/i.test(name)) return abs;
    }
  }
  return null;
}

function parseMarkdownTable(block) {
  const lines = block.split(/\r?\n/).filter((l) => l.trim().startsWith("|"));
  if (lines.length < 2) return [];
  const header = lines[0]
    .split("|")
    .map((c) => c.trim())
    .filter(Boolean);
  const offeringIdx = header.findIndex((h) => /^offering$/i.test(h));
  if (offeringIdx < 0) return [];
  const rows = [];
  for (const line of lines.slice(2)) {
    const parts = line.split("|").slice(1, -1).map((c) => c.trim());
    const name = parts[offeringIdx];
    if (name) rows.push({ offering: name, raw: parts });
  }
  return rows;
}

export function offeringsFromProductDoc(markdown) {
  const catalogMatch = markdown.match(
    /## Offering Catalog\s*([\s\S]*?)(?=\n## )/,
  );
  if (catalogMatch) {
    const rows = parseMarkdownTable(catalogMatch[1]);
    if (rows.length) return rows.map((r) => r.offering);
  }
  const profiles = markdown.match(
    /## Product and Service Profiles\s*([\s\S]*?)(?=\n## )/,
  );
  if (!profiles) return [];
  const names = [];
  for (const m of profiles[1].matchAll(/^### (.+)$/gm)) {
    names.push(m[1].trim());
  }
  return names;
}

export function loadOfferings(productDocPath) {
  const text = fs.readFileSync(productDocPath, "utf8");
  return offeringsFromProductDoc(text);
}
