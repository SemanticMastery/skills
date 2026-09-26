import fs from "node:fs";
import path from "node:path";
import { companySlug, resourcesDir } from "./paths.mjs";
import { atomicWrite, conflictCopyPresent } from "./series-record.mjs";

export const FLAG_SET = new Set(["publish_unclear", "sensitive", "pd_candidate"]);
export const PUBLISH = new Set(["public", "framing-only", "internal"]);
const RETIRE_AFTER_MS = 91 * 24 * 60 * 60 * 1000;

export function bankJsonPath(campaignDir) {
  return path.join(resourcesDir(campaignDir), `${companySlug(campaignDir)}-story-bank.json`);
}

export function loadBank(campaignDir) {
  const p = bankJsonPath(campaignDir);
  if (!fs.existsSync(p)) return { entries: [] };
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

export function writeBank(campaignDir, bank) {
  const p = bankJsonPath(campaignDir);
  if (conflictCopyPresent(p)) return { error: "conflict_copy_present" };
  atomicWrite(p, `${JSON.stringify(bank, null, 2)}\n`);
  return { path: p };
}

export function deriveFlags(story) {
  const flags = new Set((story.flags || []).filter((f) => FLAG_SET.has(f)));
  for (const f of story.flags || []) if (FLAG_SET.has(f)) flags.add(f);
  if (story.pd_candidate) flags.add("pd_candidate");
  return [...flags];
}

export function entryFromStory(story, cycle, speaker) {
  const flags = deriveFlags(story);
  const held = Boolean(story.held);
  return {
    entry_id: story.entry_id,
    call_id: story.call_id,
    cycle_no: cycle.cycle_no,
    session_id: cycle.session_id,
    speaker: story.speaker || speaker || "",
    story_key: story.story_key || "",
    headline: story.headline || "",
    words: story.words || "",
    theme: story.theme || "",
    publish_decision: PUBLISH.has(story.publish_decision) ? story.publish_decision : "public",
    flags,
    status: held ? "held" : "fresh",
    held,
    used_at: null,
    pd_handoff: null,
    started_at: cycle.calls?.find((c) => c.call_id === story.call_id)?.started_at || null,
  };
}

export function mergeEntries(existing, incoming) {
  const byId = new Map((existing || []).map((e) => [e.entry_id, e]));
  let added = 0;
  for (const next of incoming) {
    const prev = byId.get(next.entry_id);
    if (!prev) {
      byId.set(next.entry_id, next);
      added += 1;
      continue;
    }
    byId.set(next.entry_id, {
      ...next,
      status: prev.status,
      publish_decision: prev.publish_decision,
      flags: prev.flags,
      used_at: prev.used_at,
      pd_handoff: prev.pd_handoff,
      theme: prev.theme || next.theme,
      held: prev.status === "held" ? prev.held : next.held,
    });
  }
  return { entries: [...byId.values()], added };
}

export function retireUsed(entries, now = Date.now()) {
  return entries.map((e) => {
    if (e.status !== "used" || !e.used_at) return e;
    const age = now - Date.parse(e.used_at);
    if (Number.isFinite(age) && age >= RETIRE_AFTER_MS) {
      return { ...e, status: "retired" };
    }
    return e;
  });
}

export function markUsed(entries, ids, usedAt) {
  const set = new Set(ids);
  return entries.map((e) => (set.has(e.entry_id) ? { ...e, status: e.status === "fresh" ? "used" : e.status, used_at: e.used_at || usedAt } : e));
}

export function findEntry(bank, entryId) {
  return (bank.entries || []).find((e) => e.entry_id === entryId) || null;
}

export function openFlags(bank) {
  return (bank.entries || []).filter((e) => (e.flags || []).length && e.status !== "retired" && e.status !== "superseded");
}

export function heldEntries(bank) {
  return (bank.entries || []).filter((e) => e.held || e.status === "held");
}

export function digestEntries(bank) {
  return (bank.entries || []).filter((e) => {
    if (e.held || e.status === "held" || e.status === "retired" || e.status === "superseded" || e.status === "used") return false;
    if ((e.flags || []).length) return false;
    if (e.publish_decision === "internal") return false;
    return true;
  });
}
