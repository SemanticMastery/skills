import assert from "node:assert/strict";
import test from "node:test";
import { buildDecisionTrace } from "../build-decision-trace-from-s5.mjs";

const fixed = { now: () => "2026-09-28T16:00:00.000Z", uuid: () => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee" };

test("wayfront block keeps join keys and wayfront tags", () => {
  const trace = buildDecisionTrace({
    client_slug: "ridgeline-tree-care",
    trace: { client_id: 42, order_id: "1001", company: "Ridgeline", service: "Tree care" },
    classifier_tags: ["trace:client:42", "trace:order:1001", "intake:cap-mcp"],
    draft: { content: "## Decision\nUse https\n" },
  }, fixed);

  assert.equal(trace.client_id, "42");
  assert.equal(trace.order_id, "1001");
  assert.deepEqual(trace.tags, ["trace:client:42", "trace:order:1001"]);
});

test("manual IDs without a CRM block build a valid trace", () => {
  const trace = buildDecisionTrace({
    client_slug: "ridgeline-tree-care",
    client_id: "7",
    order_id: "88",
    draft: { content: "manual" },
  }, fixed);

  assert.equal(trace.client_slug, "ridgeline-tree-care");
  assert.equal(trace.client_id, "7");
  assert.equal(trace.order_id, "88");
  assert.equal(trace.record_type, "decision_trace");
  assert.equal("wayfront" in trace, false);
});

test("missing IDs are absent rather than the string undefined", () => {
  const trace = buildDecisionTrace({
    client_slug: "ridgeline-tree-care",
    draft: { content: "no ids" },
  }, fixed);
  const json = JSON.stringify(trace);

  assert.equal("client_id" in trace, false);
  assert.equal("order_id" in trace, false);
  assert.equal(json.includes("undefined"), false);
});

test("tags without the join-key prefix are dropped", () => {
  const trace = buildDecisionTrace({
    client_slug: "ridgeline-tree-care",
    classifier_tags: ["intake:cap-mcp", "topic:seo", "trace:order:5"],
    draft: { content: "tags" },
  }, fixed);

  assert.deepEqual(trace.tags, ["trace:order:5"]);
});
