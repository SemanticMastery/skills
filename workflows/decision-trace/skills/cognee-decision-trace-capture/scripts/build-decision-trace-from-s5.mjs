#!/usr/bin/env node
/**
 * Convert S5 output to canonical DecisionTrace JSON for Cognee remember().
 * Usage: node build-decision-trace-from-s5.mjs '<s5-json>'
 */
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const JOIN_PREFIX = "trace:";

export function buildDecisionTrace(s5, { now = () => new Date().toISOString(), uuid = randomUUID } = {}) {
  const bs = s5.draft ?? s5;
  const wf = s5.wayfront ?? {};

  const clientSlug = bs.client_id ?? s5.client_slug;
  if (!clientSlug) {
    const err = new Error("Missing client_slug / draft.client_id");
    err.code = "MISSING_CLIENT";
    throw err;
  }

  const clientId = firstDefined(wf.client_id, s5.client_id);
  const orderId = firstDefined(wf.order_id, s5.order_id);
  const company = firstDefined(wf.company, s5.company);
  const service = firstDefined(wf.service, s5.service);

  const trace = {
    schema_version: "1.0",
    record_type: "decision_trace",
    trace_id: s5.trace_lineage_id && /^[0-9a-f-]{36}$/i.test(s5.trace_lineage_id) ? s5.trace_lineage_id : uuid(),
    source_system: "cognee-dtc",
    captured_at: now(),
    client_slug: clientSlug,
    topic: s5.topic ?? `decision-trace/${clientSlug}`,
    decision: extractSection(bs.content, "Decision") ?? bs.subject ?? "see content_markdown",
    alternatives: extractList(bs.content, "Alternatives"),
    rationale_chain: extractList(bs.content, "Rationale"),
    constraints: extractList(bs.content, "Constraints"),
    rejected_options: extractList(bs.content, "Rejected"),
    classifier_tags: s5.classifier_tags ?? [],
    importance: bs.importance ?? "medium",
    knowledge_category: bs.knowledge_category ?? "strategy",
    content_markdown: bs.content ?? "",
    tags: (s5.classifier_tags ?? []).filter((t) => typeof t === "string" && t.startsWith(JOIN_PREFIX)),
  };

  assignIfDefined(trace, "client_id", clientId != null ? String(clientId) : undefined);
  assignIfDefined(trace, "order_id", orderId != null ? String(orderId) : undefined);
  assignIfDefined(trace, "company", company != null ? String(company) : undefined);
  assignIfDefined(trace, "service", service != null ? String(service) : undefined);
  assignIfDefined(trace, "campaign_name", service != null ? String(service) : undefined);
  return trace;
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function assignIfDefined(target, key, value) {
  if (value !== undefined && value !== "undefined") target[key] = value;
}

function extractSection(md, heading) {
  if (!md) return undefined;
  const re = new RegExp(`##\\s*${heading}\\s*\\n+([^#]+)`, "i");
  const m = md.match(re);
  return m ? m[1].trim().split("\n")[0].trim() : undefined;
}

function extractList(md, heading) {
  if (!md) return [];
  const re = new RegExp(`##\\s*${heading}\\s*\\n+([\\s\\S]*?)(?=\\n##|$)`, "i");
  const m = md.match(re);
  if (!m) return [];
  return m[1]
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: node build-decision-trace-from-s5.mjs '<s5-json>'");
    process.exit(1);
  }
  let s5;
  try {
    s5 = JSON.parse(raw);
  } catch {
    console.error("Invalid S5 JSON");
    process.exit(1);
  }
  try {
    console.log(JSON.stringify(buildDecisionTrace(s5), null, 2));
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
