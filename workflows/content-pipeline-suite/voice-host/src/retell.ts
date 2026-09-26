import { timingSafeEqualString } from "./session-logic";

const RETELL_BASE = "https://api.retellai.com";
export const TOOL_AUTH_HEADER = "X-Owner-Interview-Key";

export function signingKey(env: Env): string {
  return String(env.RETELL_WEBHOOK_KEY || env.RETELL_API_KEY || "").trim();
}

function apiKey(env: Env): string {
  return String(env.RETELL_API_KEY || "").trim();
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(mac)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signRetellRequest(rawBody: string, key: string, timestamp = Date.now()): Promise<string> {
  const digest = await hmacHex(key, `${rawBody}${timestamp}`);
  return `v=${timestamp},d=${digest}`;
}

export async function digestMatches(secret: string, digest: string, messages: string[]): Promise<boolean> {
  for (const message of messages) {
    const expected = await hmacHex(secret, message);
    if (timingSafeEqualHex(expected, digest)) return true;
  }
  return false;
}

export async function verifyRetellSignature(
  rawBody: string,
  signatureHeader: string | null,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  const secret = String(key || "").trim();
  const header = String(signatureHeader || "").trim();
  if (!header || !secret) return false;
  const match = /^v=(\d+),d=([0-9a-f]+)$/i.exec(header);
  if (match) {
    const timestamp = match[1];
    const digest = match[2].toLowerCase();
    if (Math.abs(now - Number(timestamp)) > 5 * 60 * 1000) return false;
    return digestMatches(secret, digest, [`${rawBody}${timestamp}`, `${timestamp}${rawBody}`, rawBody]);
  }
  if (/^[0-9a-f]{64}$/i.test(header)) {
    return digestMatches(secret, header.toLowerCase(), [rawBody]);
  }
  return false;
}

export async function verifyIncomingRetell(
  rawBody: string,
  signatureHeader: string | null,
  env: Env,
  now = Date.now(),
): Promise<boolean> {
  const webhook = String(env.RETELL_WEBHOOK_KEY || "").trim();
  const rest = String(env.RETELL_API_KEY || "").trim();
  if (webhook && (await verifyRetellSignature(rawBody, signatureHeader, webhook, now))) return true;
  if (rest && (await verifyRetellSignature(rawBody, signatureHeader, rest, now))) return true;
  return false;
}

export function toolAuthMatches(request: Request, env: Env): boolean {
  const token = String(env.OWNER_INTERVIEW_HOST_TOKEN || "").trim();
  const got = String(request.headers.get(TOOL_AUTH_HEADER) || "").trim();
  if (!token || !got) return false;
  return timingSafeEqualString(got, token);
}

export async function authorizeRetellRequest(
  rawBody: string,
  request: Request,
  env: Env,
): Promise<boolean> {
  if (await verifyIncomingRetell(rawBody, request.headers.get("X-Retell-Signature"), env)) return true;
  return toolAuthMatches(request, env);
}

export function agentIdForKind(env: Env, kind: string | undefined): string {
  if (kind === "expert") return String(env.RETELL_EXPERT_AGENT_ID || "");
  if (kind === "voice") return String(env.RETELL_VOICE_AGENT_ID || "");
  return String(env.RETELL_AGENT_ID || "");
}

export function configuredAgentIds(env: Env): string[] {
  return [env.RETELL_AGENT_ID, env.RETELL_EXPERT_AGENT_ID, env.RETELL_VOICE_AGENT_ID]
    .map((id) => String(id || ""))
    .filter(Boolean);
}

export function agentIdAllowed(env: Env, got: string, sessionKind?: string | null): boolean {
  if (!got) return true;
  if (sessionKind) {
    const expected = agentIdForKind(env, sessionKind);
    return !expected || got === expected;
  }
  const allowed = configuredAgentIds(env);
  return !allowed.length || allowed.includes(got);
}

export async function createWebCall(
  env: Env,
  sessionId: string,
  vars: Record<string, string>,
  agentKind: "owner" | "expert" | "voice" = "owner",
  fetchImpl: typeof fetch = fetch,
  opts: { maxCallDurationMs?: number } = {},
): Promise<Response> {
  const body: Record<string, unknown> = {
    agent_id: agentIdForKind(env, agentKind) || env.RETELL_AGENT_ID,
    metadata: { session_id: sessionId },
    retell_llm_dynamic_variables: vars,
  };
  if (opts.maxCallDurationMs) {
    body.agent_override = { agent: { max_call_duration_ms: opts.maxCallDurationMs } };
  }
  return fetchImpl(`${RETELL_BASE}/v3/create-web-call`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey(env)}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export async function stopCall(env: Env, callId: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(`${RETELL_BASE}/v2/stop-call/${callId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey(env)}` },
  });
}

export async function deleteCall(env: Env, callId: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  return fetchImpl(`${RETELL_BASE}/v2/delete-call/${callId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey(env)}` },
  });
}

export async function getCallStatus(
  env: Env,
  callId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ call_status?: string } | null> {
  const res = await fetchImpl(`${RETELL_BASE}/v2/get-call/${callId}`, {
    headers: { Authorization: `Bearer ${apiKey(env)}` },
  });
  if (!res.ok) return null;
  return res.json() as Promise<{ call_status?: string }>;
}
