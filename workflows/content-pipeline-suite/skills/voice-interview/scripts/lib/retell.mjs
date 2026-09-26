const RETELL_BASE = "https://api.retellai.com";

export function retellKey() {
  return String(process.env.RETELL_API_KEY || "");
}

export function keyPresent() {
  return Boolean(retellKey());
}

export class RetellError extends Error {
  constructor({ message, http, code }) {
    super(message);
    this.name = "RetellError";
    this.http = http;
    this.code = code;
  }
}

function redact(value) {
  const text = String(value ?? "");
  return text.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 200);
}

function typedError({ message, http, code, body }) {
  return new RetellError({
    message: redact(message || body || `HTTP ${http || ""}`.trim()),
    http,
    code,
  });
}

export async function retellRequest({
  method = "GET",
  path,
  fetchImpl = globalThis.fetch,
  key = retellKey(),
} = {}) {
  if (!key) {
    throw typedError({ message: "RETELL_API_KEY is not set", code: "MISSING_LOCAL_KEY" });
  }
  const headers = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  const url = `${RETELL_BASE}${path}`;
  const run = () =>
    fetchImpl(url, { method, headers, signal: AbortSignal.timeout(8000) });

  let res;
  try {
    res = await run();
    if (res.status === 429) {
      const waitSec = Math.min(Number(res.headers.get("retry-after") || 0), 30);
      if (waitSec > 0) await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      res = await run();
    }
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.code === "TIMEOUT" || /timeout/i.test(err?.message || "")) {
      throw typedError({ message: "timeout", code: "timeout" });
    }
    throw typedError({ message: err?.message || "request_failed", code: "retell_http_error" });
  }

  const text = await res.text();
  let json = {};
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 200) };
    }
  }
  if (!res.ok) {
    throw typedError({
      message: json.message || json.error || text,
      http: res.status,
      code: json.code || "retell_http_error",
      body: text,
    });
  }
  return json;
}

export function getCall(callId, opts = {}) {
  return retellRequest({ path: `/v2/get-call/${callId}`, ...opts });
}
