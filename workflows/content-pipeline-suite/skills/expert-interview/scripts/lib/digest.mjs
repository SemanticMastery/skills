import { digestEntries } from "./bank.mjs";

function sessionStamp(entry) {
  return String(entry.started_at || "").slice(0, 10) || `c${entry.cycle_no}`;
}

export function renderDigest(bank, { company = "Campaign" } = {}) {
  const rows = digestEntries(bank);
  const groups = new Map();
  for (const e of rows) {
    const theme = e.theme || "Untagged";
    if (!groups.has(theme)) groups.set(theme, []);
    groups.get(theme).push(e);
  }
  for (const list of groups.values()) {
    list.sort((a, b) => String(b.started_at || "").localeCompare(String(a.started_at || "")));
  }
  const themes = [...groups.keys()].sort((a, b) => a.localeCompare(b));
  const lines = [`# ${company} story bank`, ""];
  for (const theme of themes) {
    lines.push(`## ${theme}`, "");
    for (const e of groups.get(theme)) {
      const suffix = e.publish_decision === "framing-only" ? " (framing only — no specifics)" : "";
      lines.push(`- \`${e.entry_id}\` (${sessionStamp(e)}) ${e.headline}${suffix}`);
    }
    lines.push("");
  }
  const all = bank.entries || [];
  lines.push(
    `Fresh in digest: ${rows.length}. Total: ${all.length}. Flagged: ${all.filter((e) => (e.flags || []).length).length}. Held: ${all.filter((e) => e.held || e.status === "held").length}.`,
    "",
  );
  return lines.join("\n");
}
