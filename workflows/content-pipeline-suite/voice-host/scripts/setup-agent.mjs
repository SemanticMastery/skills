#!/usr/bin/env node
/**
 * Create or update the shared Retell agent from retell/ templates.
 * Does not run against a live account unless RETELL_API_KEY is set and
 * the operator passes --apply (create/update) or --verify.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHmac } from "node:crypto";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "..");
const BASE = "https://api.retellai.com";

export function templatePaths(templateDir = "retell") {
  const dir = path.join(ROOT, templateDir);
  return {
    agent: path.join(dir, "agent.json"),
    prompt: path.join(dir, "prompt.md"),
  };
}

export function loadTemplate({ prompt, agent, templateDir = "retell" } = {}) {
  const paths = templatePaths(templateDir);
  const raw = agent || JSON.parse(fs.readFileSync(paths.agent, "utf8"));
  const text = prompt || fs.readFileSync(paths.prompt, "utf8");
  return { raw, prompt: text, templateDir };
}

export function assertHttpsWorkerUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("worker_url_insecure");
  }
  if (parsed.protocol !== "https:") throw new Error("worker_url_insecure");
  return parsed.origin;
}

export function materialize(template, workerUrl) {
  const origin = assertHttpsWorkerUrl(workerUrl);
  const filled = JSON.parse(JSON.stringify(template.raw).replaceAll("{{WORKER_URL}}", origin));
  if (JSON.stringify(filled).includes("{{WORKER_URL}}")) throw new Error("worker_url_unreplaced");
  filled.llm = filled.llm || {};
  filled.llm.general_prompt = template.prompt;
  return filled;
}

export function attachToolAuth(filled, token) {
  const secret = String(token || "").trim();
  if (!secret) return filled;
  const tools = (filled.llm?.general_tools || []).map((tool) => {
    if (tool.type !== "custom") return tool;
    return {
      ...tool,
      headers: { ...(tool.headers || {}), "X-Owner-Interview-Key": secret },
    };
  });
  return { ...filled, llm: { ...filled.llm, general_tools: tools } };
}

export function agentPayload(filled, llmId) {
  const { llm: _llm, response_engine: _re, ...rest } = filled;
  return {
    ...rest,
    response_engine: { type: "retell-llm", llm_id: llmId },
  };
}

export const VOICE_LIST_FILTER = {
  channel: { type: "string", op: "eq", value: "voice" },
};

export function listAsArray(payload) {
  if (Array.isArray(payload)) return payload;
  return payload.items || payload.agents || payload.data || [];
}

export async function listAllAgents(fetchImpl = fetch, { filter_criteria = VOICE_LIST_FILTER } = {}) {
  const agents = [];
  let pagination_key;
  let has_more = true;
  while (has_more) {
    const body = { filter_criteria };
    if (pagination_key) body.pagination_key = pagination_key;
    const listed = await retell("POST", "/v2/list-agents", body, fetchImpl);
    agents.push(...listAsArray(listed));
    pagination_key = listed.pagination_key;
    has_more = Boolean(listed.has_more);
  }
  return agents;
}

function key() {
  return process.env.RETELL_API_KEY || "";
}

export async function retell(method, pathName, body, fetchImpl = fetch) {
  const res = await fetchImpl(`${BASE}${pathName}`, {
    method,
    headers: {
      Authorization: `Bearer ${key()}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  if (!res.ok) {
    const err = new Error(`retell_http_${res.status}`);
    err.payload = json;
    throw err;
  }
  return json;
}

export function signSelftest(body, secret, timestamp = Date.now()) {
  const raw = typeof body === "string" ? body : JSON.stringify(body);
  const digest = createHmac("sha256", secret).update(`${raw}${timestamp}`).digest("hex");
  return { raw, header: `v=${timestamp},d=${digest}` };
}

export async function applyLive({ workerUrl, name, templateDir = "retell", fetchImpl = fetch } = {}) {
  const token = String(process.env.OWNER_INTERVIEW_HOST_TOKEN || "").trim();
  const template = loadTemplate({ templateDir });
  const agentName = name || template.raw.agent_name || "owner-interview";
  const filled = attachToolAuth(materialize(template, workerUrl), token);
  const existing = (await listAllAgents(fetchImpl)).find((agent) => agent.agent_name === agentName);
  if (!existing) {
    const created = await retell("POST", "/create-retell-llm", filled.llm, fetchImpl);
    const agent = await retell("POST", "/create-agent", agentPayload(filled, created.llm_id), fetchImpl);
    return {
      action: "created",
      agent_id: agent.agent_id,
      llm_id: created.llm_id,
      webhook_url: filled.webhook_url,
    };
  }
  let llmId = existing.response_engine?.llm_id;
  if (!llmId && existing.agent_id) {
    const live = await retell("GET", `/get-agent/${existing.agent_id}`, undefined, fetchImpl);
    llmId = live.response_engine?.llm_id;
  }
  if (!llmId) throw new Error("existing_agent_missing_llm");
  await retell("PATCH", `/update-retell-llm/${llmId}`, filled.llm, fetchImpl);
  await retell("PATCH", `/update-agent/${existing.agent_id}`, agentPayload(filled, llmId), fetchImpl);
  return {
    action: "updated",
    agent_id: existing.agent_id,
    llm_id: llmId,
    webhook_url: filled.webhook_url,
  };
}

export function envNameForTemplate(templateDir = "retell") {
  if (String(templateDir).includes("voice")) return "RETELL_VOICE_AGENT_ID";
  if (String(templateDir).includes("expert")) return "RETELL_EXPERT_AGENT_ID";
  return "RETELL_AGENT_ID";
}

export async function verifyLive({ workerUrl, agentId, webhookKey, templateDir = "retell", fetchImpl = fetch } = {}) {
  const origin = assertHttpsWorkerUrl(workerUrl);
  const template = loadTemplate({ templateDir });
  const filled = materialize(template, workerUrl);
  const envName = envNameForTemplate(templateDir);
  const id = agentId || process.env[envName] || "";
  if (id) {
    const live = await retell("GET", `/get-agent/${id}`, undefined, fetchImpl);
    if (live.data_storage_setting !== filled.data_storage_setting) {
      throw new Error("data_storage_setting_drift");
    }
  }
  const secret = webhookKey || process.env.RETELL_WEBHOOK_KEY || key();
  const payload = { ok: true, agent_id: id };
  const signed = signSelftest(payload, secret);
  const res = await fetchImpl(`${origin}/retell/selftest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Retell-Signature": signed.header },
    body: signed.raw,
  });
  if (!res.ok) throw new Error(`selftest_${res.status}`);
  return res.json();
}

function parseArgs(argv) {
  const out = { apply: false, verify: false, workerUrl: "", name: "", template: "retell" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--apply") out.apply = true;
    else if (argv[i] === "--verify") out.verify = true;
    else if (argv[i] === "--worker-url") out.workerUrl = argv[++i];
    else if (argv[i] === "--name") out.name = argv[++i];
    else if (argv[i] === "--template") out.template = argv[++i];
  }
  return out;
}

export async function main(argv = process.argv, fetchImpl = fetch) {
  const args = parseArgs(argv);
  const template = loadTemplate({ templateDir: args.template });
  if (!args.workerUrl) {
    console.log(JSON.stringify({ ok: true, dry: true, agent_name: template.raw.agent_name }));
    return 0;
  }
  const filled = materialize(template, args.workerUrl);
  if (args.verify) {
    const result = await verifyLive({ workerUrl: args.workerUrl, templateDir: args.template, fetchImpl });
    console.log(JSON.stringify({ ok: true, verify: result }));
    return 0;
  }
  if (!args.apply) {
    console.log(JSON.stringify({ ok: true, ready: true, webhook_url: filled.webhook_url }));
    return 0;
  }
  if (!key()) throw new Error("RETELL_API_KEY missing");
  const result = await applyLive({
    workerUrl: args.workerUrl,
    name: args.name || template.raw.agent_name,
    templateDir: args.template,
    fetchImpl,
  });
  console.log(JSON.stringify({ ok: true, ...result }));
  return 0;
}

if (process.argv[1] && path.normalize(process.argv[1]) === path.normalize(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(JSON.stringify({ error: err.message }));
    process.exit(1);
  });
}
