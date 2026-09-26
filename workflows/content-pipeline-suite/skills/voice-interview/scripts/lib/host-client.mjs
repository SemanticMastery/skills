export function hostToken() {
  return String(process.env.OWNER_INTERVIEW_HOST_TOKEN || "");
}

export function hostUrl() {
  return String(process.env.OWNER_INTERVIEW_HOST_URL || "").replace(/\/$/, "");
}

export function keyPresent() {
  return Boolean(hostToken());
}

export class HostError extends Error {
  constructor({ message, http, code }) {
    super(message);
    this.name = "HostError";
    this.http = http;
    this.code = code;
  }
}

function redact(value) {
  return String(value ?? "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 200);
}

export function assertHostUrl(url = hostUrl()) {
  if (!url) {
    throw new HostError({ message: "OWNER_INTERVIEW_HOST_URL is not set", code: "host_url_insecure" });
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new HostError({ message: "host_url_insecure", code: "host_url_insecure" });
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !local) {
    throw new HostError({ message: "host_url_insecure", code: "host_url_insecure" });
  }
  return parsed.origin;
}

function typedFromResponse(res, text) {
  if (res.status === 401) {
    return new HostError({ message: "host_auth_failed", http: 401, code: "host_auth_failed" });
  }
  if (res.status === 503) {
    return new HostError({ message: "host_token_unset", http: 503, code: "host_token_unset" });
  }
  return new HostError({
    message: redact(text || `HTTP ${res.status}`),
    http: res.status,
    code: "host_http_error",
  });
}

export async function hostRequest({
  method = "GET",
  path,
  body,
  fetchImpl = globalThis.fetch,
  url = hostUrl(),
  token = hostToken(),
} = {}) {
  const origin = assertHostUrl(url);
  if (!token) {
    throw new HostError({ message: "host_token_unset", http: 503, code: "host_token_unset" });
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let res;
  try {
    const run = () =>
      fetchImpl(`${origin}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(8000),
      });
    res = await run();
    if (res.status === 429) {
      const waitSec = Math.min(Number(res.headers.get("retry-after") || 0), 30);
      if (waitSec > 0) await new Promise((resolve) => setTimeout(resolve, waitSec * 1000));
      res = await run();
    }
  } catch (err) {
    if (err?.code === "host_url_insecure") throw err;
    if (err?.name === "TimeoutError" || /timeout/i.test(err?.message || "")) {
      throw new HostError({ message: "timeout", code: "timeout" });
    }
    throw new HostError({ message: redact(err?.message || "request_failed"), code: "host_http_error" });
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
  if (!res.ok) throw typedFromResponse(res, text);
  return json;
}

export function createSession(payload, opts = {}) {
  return hostRequest({ method: "POST", path: "/admin/sessions", body: payload, ...opts });
}

export function getStatus(sessionId, opts = {}) {
  return hostRequest({ path: `/admin/sessions/${sessionId}`, ...opts });
}

export function exportSession(sessionId, opts = {}) {
  return hostRequest({ path: `/admin/sessions/${sessionId}/export`, ...opts });
}

export function ackPulled(sessionId, callIds, opts = {}) {
  return hostRequest({
    method: "POST",
    path: `/admin/sessions/${sessionId}/ack`,
    body: { call_ids: callIds },
    ...opts,
  });
}

/** Allowlisted voice payload (KTD16). createSession still posts /admin/sessions. */
export function voiceSessionPayload({
  campaign,
  agency,
  speaker,
  speaker_slug,
  expires,
  notice_version = "voice-notice-v1",
} = {}) {
  const body = {
    agent_kind: "voice",
    campaign,
    agency,
    speaker,
    speaker_slug,
    notice_version,
  };
  if (expires) body.expires = expires;
  return body;
}
