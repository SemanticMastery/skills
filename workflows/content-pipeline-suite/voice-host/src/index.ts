import { agentIdAllowed, authorizeRetellRequest, createWebCall, verifyIncomingRetell } from "./retell";
import { Series } from "./series";
import { InterviewSession, SessionIndex } from "./session";
import { distinctSeriesIds, publicOrigin, seriesLink, tokenIndexKey, validateSeriesCreate } from "./series-logic";
import { randomHex, timingSafeEqualString } from "./session-logic";

export { InterviewSession, Series, SessionIndex };

const PAGE_FALLBACK = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{{page_title}}</title>
  <link rel="stylesheet" href="/app.css" />
</head>
<body>
  <main data-session-id="{{session_id}}" data-agent-kind="{{agent_kind}}" data-released="{{released}}">
    <p id="page-state">{{page_state}}</p>
    <h1 id="service">{{service_title}}</h1>
    <p id="notice">{{notice}}</p>
    <div id="release" hidden>
      <label for="release-name">Type your name to confirm</label>
      <input id="release-name" name="release-name" type="text" autocomplete="name" />
      <button type="button" id="release-confirm">Confirm</button>
    </div>
    {{start_button}}
    <p id="live" hidden>Live</p>
    <p id="status"></p>
    <p id="phase"></p>
    <p id="card"></p>
    <div id="taps" hidden>
      <p id="publish-lead">When asked how we may use what you just said:</p>
      <ul id="publish-legend">
        <li><strong>Public</strong> — we may put it on the website as you said it.</li>
        <li><strong>Framing-only</strong> — we may use the idea in general language, without specific numbers, brands, or names.</li>
        <li><strong>Internal</strong> — we keep it in the interview record only. It will not appear on the website.</li>
      </ul>
      <div id="tap-buttons">
        <button type="button" data-tap="public">Public</button>
        <button type="button" data-tap="framing-only">Framing-only</button>
        <button type="button" data-tap="internal">Internal</button>
      </div>
    </div>
  </main>
  <script src="/retell-client.js"></script>
  <script src="/app.js"></script>
</body>
</html>`;

const RETELL_MEDIA =
  "https://api.retellai.com https://*.retellai.com wss://*.retellai.com wss://*.livekit.cloud https://*.livekit.cloud stun:stun.l.google.com:19302";
const CSP = `default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ${RETELL_MEDIA}; media-src 'self' https://*.retellai.com blob: mediastream:; img-src 'self' data:;`;

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

function bearer(header: string | null): string {
  if (!header) return "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

function adminAuth(request: Request, env: Env): Response | null {
  const token = String(env.OWNER_INTERVIEW_HOST_TOKEN || "");
  if (!token) return json({ error: "host_token_unset" }, 503);
  const got = bearer(request.headers.get("Authorization"));
  if (!got || !timingSafeEqualString(got, token)) return json({ error: "host_auth_failed" }, 401);
  return null;
}

function sessionStub(env: Env, sessionId: string) {
  return env.SESSION.get(env.SESSION.idFromName(sessionId));
}

function indexStub(env: Env) {
  return env.INDEX.get(env.INDEX.idFromName("main"));
}

function seriesStub(env: Env, seriesId: string) {
  return env.SERIES.get(env.SERIES.idFromName(seriesId));
}

function pageHeaders(): HeadersInit {
  return {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": CSP,
  };
}

function escapeText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const OWNER_NOTICE =
  "{{agency_name}} is interviewing {{owner_name}} about {{service_title}} at {{company_name}}. This call is recorded. Press Start only if you agree.";
const OWNER_WAIT_NOTICE =
  "{{agency_name}} is interviewing {{owner_name}} about {{service_title}} at {{company_name}}. This call is recorded.";
const VOICE_NOTICE =
  "This call is recorded and transcribed by an AI interviewer. Your answers create a style profile used to draft marketing content in your voice for {{company_name}} only. This is not a voice clone and not an identification voiceprint. Type your name to confirm, then press Start.";

function fillPage(
  html: string,
  data: {
    agency_name?: string;
    company_name?: string;
    owner_name?: string;
    service_title?: string;
    session_id?: string;
    page_title?: string;
    page_state?: string;
    start?: boolean;
    agent_kind?: string;
    released?: boolean;
    notice?: string;
  },
): string {
  const start = data.start ? `<button type="button" id="start">Start</button>` : "";
  const notice = (data.notice || OWNER_NOTICE)
    .replaceAll("{{agency_name}}", data.agency_name || "")
    .replaceAll("{{company_name}}", data.company_name || "")
    .replaceAll("{{owner_name}}", data.owner_name || "")
    .replaceAll("{{service_title}}", data.service_title || "");
  return html
    .replaceAll("{{agency_name}}", escapeText(data.agency_name || ""))
    .replaceAll("{{company_name}}", escapeText(data.company_name || ""))
    .replaceAll("{{owner_name}}", escapeText(data.owner_name || ""))
    .replaceAll("{{service_title}}", escapeText(data.service_title || ""))
    .replaceAll("{{session_id}}", escapeText(data.session_id || ""))
    .replaceAll("{{page_title}}", escapeText(data.page_title || `${data.agency_name || ""} · ${data.company_name || ""}`.trim()))
    .replaceAll("{{page_state}}", escapeText(data.page_state || ""))
    .replaceAll("{{agent_kind}}", escapeText(data.agent_kind || "owner"))
    .replaceAll("{{released}}", data.released ? "1" : "0")
    .replaceAll("{{notice}}", escapeText(notice))
    .replaceAll("{{start_button}}", start);
}

function voiceIndexKey(payload: Record<string, unknown>): string {
  const campaign = String(payload.campaign || "");
  const speaker = String(payload.speaker_slug || payload.speaker || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `voice::${campaign}::${speaker}`;
}

function voiceAgencySlug(payload: Record<string, unknown>): string {
  return String(payload.agency_slug || payload.agency || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sessionPublicUrl(origin: string, payload: Record<string, unknown>, sessionId: string): string {
  const slug = voiceAgencySlug(payload);
  if (payload.agent_kind === "voice") {
    if (slug) return `${origin}/v/${slug}/${sessionId}`;
    return `${origin}/s/${sessionId}`;
  }
  if (slug) return `${origin}/i/${slug}/${sessionId}`;
  return `${origin}/s/${sessionId}`;
}

async function pageTemplate(env: Env, request: Request): Promise<string> {
  if (env.ASSETS) {
    const res = await env.ASSETS.fetch(new URL("/index.html", request.url));
    if (res.ok) return res.text();
  }
  return PAGE_FALLBACK;
}

function sessionIdFromCreate(request: Request, body: Record<string, unknown>): string {
  const header = request.headers.get("X-Session-Id");
  if (header) return header;
  const meta = (body.metadata || {}) as Record<string, unknown>;
  if (body.session_id) return String(body.session_id);
  if (meta.session_id) return String(meta.session_id);
  const referer = request.headers.get("Referer") || "";
  const match = /\/(?:s|i\/[^/]+|v\/[^/]+)\/([a-f0-9]{32})/i.exec(referer);
  return match ? match[1] : "";
}

function metadataSessionId(payload: Record<string, unknown>): string {
  const call = (payload.call || {}) as Record<string, unknown>;
  const meta = (call.metadata || payload.metadata || {}) as Record<string, unknown>;
  return String(meta.session_id || "");
}

function agentIdOf(payload: Record<string, unknown>): string {
  const call = (payload.call || {}) as Record<string, unknown>;
  return String(call.agent_id || payload.agent_id || "");
}

async function readRaw(request: Request): Promise<string> {
  return request.text();
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/admin/")) {
      const denied = adminAuth(request, env);
      if (denied) return denied;
      if (path === "/admin/sessions" && request.method === "POST") {
        const payload = (await request.json()) as Record<string, unknown>;
        const voice = payload.agent_kind === "voice";
        const key = voice ? voiceIndexKey(payload) : `${payload.record_id || ""}::${payload.pack_hash || ""}`;
        const idx = await indexStub(env).fetch(new Request(`https://index/lookup?key=${encodeURIComponent(key)}`));
        const found = (await idx.json()) as { session_id?: string };
        if (found.session_id) {
          const existing = await sessionStub(env, found.session_id).fetch("https://do/status");
          if (existing.ok) {
            const view = (await existing.json()) as { resumable?: boolean; status?: string };
            if (voice && view.status && !["completed", "consent_refused", "consent_withdrawn", "expired", "purged"].includes(String(view.status))) {
              await sessionStub(env, found.session_id).fetch(new Request("https://do/expire", { method: "POST" }));
            } else if (!voice && view.resumable) {
              const labeled = await sessionStub(env, found.session_id).fetch(
                new Request("https://do/labels", { method: "POST", body: JSON.stringify(payload) }),
              );
              const updated = labeled.ok ? ((await labeled.json()) as Record<string, unknown>) : view;
              return json({
                ...updated,
                url: sessionPublicUrl(url.origin, { ...payload, ...updated }, found.session_id),
                session_id: found.session_id,
              });
            }
          }
        }
        const sessionId = randomHex(16);
        payload.session_id = sessionId;
        payload.origin = url.origin;
        const created = await sessionStub(env, sessionId).fetch(
          new Request("https://do/init", { method: "POST", body: JSON.stringify(payload) }),
        );
        const view = (await created.json()) as Record<string, unknown>;
        await indexStub(env).fetch(
          new Request("https://index/bind", {
            method: "POST",
            body: JSON.stringify({ key, session_id: sessionId }),
          }),
        );
        return json({ ...view, session_id: sessionId, url: sessionPublicUrl(url.origin, { ...payload, ...view }, sessionId) });
      }
      const adminMatch = /^\/admin\/sessions\/([^/]+)(\/export|\/ack|\/expire)?$/.exec(path);
      if (adminMatch) {
        const sessionId = adminMatch[1];
        const tail = adminMatch[2] || "";
        if (tail === "/export") return sessionStub(env, sessionId).fetch("https://do/export");
        if (tail === "/ack" && request.method === "POST") {
          return sessionStub(env, sessionId).fetch(new Request("https://do/ack", { method: "POST", body: await request.text() }));
        }
        if (tail === "/expire" && request.method === "POST") {
          return sessionStub(env, sessionId).fetch(new Request("https://do/expire", { method: "POST" }));
        }
        return sessionStub(env, sessionId).fetch("https://do/status");
      }
      if (path === "/admin/series" && request.method === "POST") {
        const payload = (await request.json()) as Record<string, unknown>;
        const invalid = validateSeriesCreate(payload);
        if (!invalid.ok) return json({ error: invalid.error, field: invalid.field }, invalid.status);
        const ids = distinctSeriesIds();
        const origin = publicOrigin(env.PUBLIC_ORIGIN, url.origin);
        payload.series_id = ids.series_id;
        payload.link_token = ids.link_token;
        payload.origin = origin;
        const created = await seriesStub(env, ids.series_id).fetch(
          new Request("https://do/init", { method: "POST", body: JSON.stringify(payload) }),
        );
        const view = (await created.json()) as Record<string, unknown>;
        await indexStub(env).fetch(
          new Request("https://index/bind", {
            method: "POST",
            body: JSON.stringify({ key: tokenIndexKey(String(payload.agency_slug), ids.link_token), series_id: ids.series_id }),
          }),
        );
        return json({
          ...view,
          series_id: ids.series_id,
          link_token: ids.link_token,
          url: seriesLink(origin, String(payload.agency_slug).toLowerCase(), ids.link_token),
        });
      }
      const seriesMatch = /^\/admin\/series\/([^/]+)(\/export|\/ack|\/rotate-link|\/release|\/hold)?$/.exec(path);
      if (seriesMatch) {
        const seriesId = seriesMatch[1];
        const tail = seriesMatch[2] || "";
        if (tail === "/export") {
          const dest = new URL("https://do/export");
          dest.search = url.search;
          return seriesStub(env, seriesId).fetch(dest.toString());
        }
        if (tail === "/ack" && request.method === "POST") {
          return seriesStub(env, seriesId).fetch(new Request("https://do/ack", { method: "POST", body: await request.text() }));
        }
        if (tail === "/release" && request.method === "POST") {
          return seriesStub(env, seriesId).fetch(new Request("https://do/ledger/release", { method: "POST", body: await request.text() }));
        }
        if (tail === "/hold" && request.method === "POST") {
          return seriesStub(env, seriesId).fetch(new Request("https://do/ledger/hold", { method: "POST", body: await request.text() }));
        }
        if (tail === "/rotate-link" && request.method === "POST") {
          const current = await seriesStub(env, seriesId).fetch("https://do/status");
          if (!current.ok) return current;
          const before = (await current.json()) as { agency_slug?: string; link_token?: string };
          const rotated = await seriesStub(env, seriesId).fetch(new Request("https://do/rotate-link", { method: "POST" }));
          if (!rotated.ok) return rotated;
          const after = (await rotated.json()) as { link_token?: string; previous_token?: string; agency_slug?: string };
          const agency = String(after.agency_slug || before.agency_slug || "");
          if (before.link_token) {
            await indexStub(env).fetch(
              new Request("https://index/bind", {
                method: "POST",
                body: JSON.stringify({ key: tokenIndexKey(agency, before.link_token), unbind: true }),
              }),
            );
          }
          if (after.link_token) {
            await indexStub(env).fetch(
              new Request("https://index/bind", {
                method: "POST",
                body: JSON.stringify({ key: tokenIndexKey(agency, after.link_token), series_id: seriesId }),
              }),
            );
          }
          return json(after);
        }
        if (request.method === "PATCH") {
          return seriesStub(env, seriesId).fetch(new Request("https://do/patch", { method: "POST", body: await request.text() }));
        }
        return seriesStub(env, seriesId).fetch("https://do/status");
      }
      return json({ error: "not_found" }, 404);
    }

    const expertMatch = /^\/e\/([^/]+)\/([^/]+)$/.exec(path);
    if (expertMatch) {
      const agency = expertMatch[1];
      const token = expertMatch[2];
      const idx = await indexStub(env).fetch(new Request(`https://index/lookup?key=${encodeURIComponent(tokenIndexKey(agency, token))}`));
      const found = (await idx.json()) as { series_id?: string; session_id?: string };
      const seriesId = found.series_id || found.session_id;
      if (!seriesId) return new Response("Not found", { status: 404, headers: pageHeaders() });
      const resolved = await seriesStub(env, seriesId).fetch(new Request("https://do/resolve"));
      if (resolved.status === 404 || resolved.status === 410) return new Response("Not found", { status: resolved.status === 410 ? 410 : 404, headers: pageHeaders() });
      const data = (await resolved.json()) as {
        agency_slug?: string;
        agency_name?: string;
        company_name?: string;
        owner_name?: string;
        action?: string;
        session_id?: string;
        next_date?: string;
        status?: string;
        timezone?: string;
      };
      if (String(data.agency_slug || "").toLowerCase() !== agency.toLowerCase()) {
        return new Response("Not found", { status: 404, headers: pageHeaders() });
      }
      let pageState = "";
      let start = false;
      let sessionId = "";
      if (data.action === "paused") pageState = "This series is paused.";
      else if (data.action === "ended") pageState = "This series has ended.";
      else if (data.action === "next_date") {
        const zone = data.timezone || "UTC";
        const when = data.next_date
          ? new Date(data.next_date).toLocaleString("en-US", { timeZone: zone })
          : "";
        pageState = when ? `Your next session is ${when}` : "Your next session is not scheduled yet.";
      } else if (data.action === "resume" || data.action === "mint") {
        start = true;
        sessionId = String(data.session_id || "");
      }
      const html = fillPage(await pageTemplate(env, request), {
        agency_name: data.agency_name,
        company_name: data.company_name,
        owner_name: data.owner_name,
        service_title: "",
        session_id: sessionId,
        page_title: `${data.agency_name || ""} · ${data.company_name || ""}`.replace(/^\s·\s/, "").trim(),
        page_state: pageState,
        start,
        notice: start ? OWNER_NOTICE : OWNER_WAIT_NOTICE,
      });
      return new Response(html, { headers: pageHeaders() });
    }

    const branded = /^\/i\/([^/]+)\/([^/]+)$/.exec(path);
    if (branded) {
      const agency = branded[1];
      const sessionId = branded[2];
      const page = await sessionStub(env, sessionId).fetch("https://do/page");
      if (page.status === 404) return new Response("Not found", { status: 404, headers: pageHeaders() });
      const data = (await page.json()) as {
        agency_slug?: string;
        agency_name: string;
        company_name: string;
        owner_name: string;
        service_title: string;
        finished?: boolean;
        session_id?: string;
        agent_kind?: string;
        released?: boolean;
      };
      if (!data.agency_slug || data.agency_slug.toLowerCase() !== agency.toLowerCase()) {
        return new Response("Not found", { status: 404, headers: pageHeaders() });
      }
      const html = fillPage(await pageTemplate(env, request), {
        ...data,
        session_id: data.session_id || sessionId,
        page_title: `${data.service_title || data.agency_name} · ${data.company_name}`,
        start: !data.finished,
        agent_kind: data.agent_kind || "owner",
        released: Boolean(data.released),
      });
      return new Response(html, { headers: pageHeaders() });
    }

    const voicePage = /^\/v\/([^/]+)\/([^/]+)$/.exec(path);
    if (voicePage) {
      const agency = voicePage[1];
      const sessionId = voicePage[2];
      const page = await sessionStub(env, sessionId).fetch("https://do/page");
      if (page.status === 404) return new Response("Not found", { status: 404, headers: pageHeaders() });
      const data = (await page.json()) as {
        agency_slug?: string;
        agency_name: string;
        company_name: string;
        owner_name: string;
        service_title: string;
        finished?: boolean;
        session_id?: string;
        agent_kind?: string;
        released?: boolean;
        notice_version?: string;
      };
      if (!data.agency_slug || data.agency_slug.toLowerCase() !== agency.toLowerCase()) {
        return new Response("Not found", { status: 404, headers: pageHeaders() });
      }
      const html = fillPage(await pageTemplate(env, request), {
        ...data,
        session_id: data.session_id || sessionId,
        page_title: `${data.agency_name || "Interview"} · ${data.company_name}`,
        start: !data.finished,
        agent_kind: data.agent_kind || "voice",
        released: Boolean(data.released),
        notice: VOICE_NOTICE,
      });
      return new Response(html, { headers: pageHeaders() });
    }

    if (path.startsWith("/s/")) {
      const sessionId = path.slice(3).split("/")[0];
      const page = await sessionStub(env, sessionId).fetch("https://do/page");
      if (page.status === 404) return new Response("Not found", { status: 404, headers: pageHeaders() });
      const data = (await page.json()) as {
        session_id?: string;
        agency_name: string;
        company_name: string;
        owner_name: string;
        service_title: string;
        finished?: boolean;
        agent_kind?: string;
        released?: boolean;
      };
      const html = fillPage(await pageTemplate(env, request), {
        ...data,
        session_id: data.session_id || sessionId,
        page_title: `${data.service_title || "Interview"} · ${data.company_name}`,
        start: !data.finished,
        agent_kind: data.agent_kind || "owner",
        released: Boolean(data.released),
      });
      return new Response(html, { headers: pageHeaders() });
    }

    if (path === "/release" && request.method === "POST") {
      const sessionId = request.headers.get("X-Session-Id") || "";
      if (!sessionId) return json({ error: "session_required" }, 400);
      return sessionStub(env, sessionId).fetch(
        new Request("https://do/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: await request.text(),
        }),
      );
    }

    if (path === "/v3/create-web-call" && request.method === "POST") {
      const raw = await request.text();
      let body: Record<string, unknown> = {};
      try {
        body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      } catch {
        body = {};
      }
      const sessionId = sessionIdFromCreate(request, body);
      if (!sessionId) return json({ error: "session_required" }, 400);
      const start = await sessionStub(env, sessionId).fetch(new Request("https://do/start", { method: "POST" }));
      if (!start.ok) return start;
      const pageToken = start.headers.get("X-Page-Token") || "";
      const started = (await start.json()) as {
        vars?: Record<string, string>;
        agent_kind?: "owner" | "expert" | "voice";
        max_call_duration_ms?: number;
      };
      const forwarded = await createWebCall(
        env,
        sessionId,
        started.vars || {},
        started.agent_kind || "owner",
        fetch,
        { maxCallDurationMs: started.max_call_duration_ms },
      );
      const text = await forwarded.text();
      if (!forwarded.ok) {
        await sessionStub(env, sessionId).fetch(new Request("https://do/revert-opened", { method: "POST" }));
        return new Response(text || JSON.stringify({ error: "retell_create_failed" }), {
          status: forwarded.status,
          headers: { "Content-Type": forwarded.headers.get("Content-Type") || "application/json" },
        });
      }
      let parsed: { call_id?: string } = {};
      try {
        parsed = JSON.parse(text) as { call_id?: string };
      } catch {
        parsed = {};
      }
      if (parsed.call_id) {
        await sessionStub(env, sessionId).fetch(
          new Request("https://do/bind", { method: "POST", body: JSON.stringify({ call_id: parsed.call_id }) }),
        );
      }
      return new Response(text, {
        status: forwarded.status,
        headers: {
          "Content-Type": forwarded.headers.get("Content-Type") || "application/json",
          "X-Page-Token": pageToken,
        },
      });
    }

    if ((path === "/q" && request.method === "GET") || (path === "/tap" && request.method === "POST")) {
      const sessionId = request.headers.get("X-Session-Id") || url.searchParams.get("session") || "";
      if (!sessionId) return json({ error: "session_required" }, 400);
      if (url.searchParams.get("token")) {
        /* query tokens are ignored */
      }
      const token = request.headers.get("X-Page-Token");
      const dest = path === "/q" ? "https://do/q" : "https://do/tap";
      return sessionStub(env, sessionId).fetch(
        new Request(dest, {
          method: request.method,
          headers: { "X-Page-Token": token || "", "Content-Type": "application/json" },
          body: path === "/tap" ? await request.text() : undefined,
        }),
      );
    }

    if (path === "/retell/selftest" && request.method === "POST") {
      const raw = await readRaw(request);
      const sig = request.headers.get("X-Retell-Signature");
      const okSig = await verifyIncomingRetell(raw, sig, env);
      if (!okSig) {
        console.log("retell_sig", "selftest", sig ? "mismatch" : "missing");
        return json({ error: "bad_signature" }, 401);
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      if (!agentIdAllowed(env, agentIdOf(payload))) {
        return json({ error: "agent_mismatch" }, 401);
      }
      return json({ ok: true });
    }

    if ((path === "/retell/tool" || path === "/retell/webhook") && request.method === "POST") {
      const raw = await readRaw(request);
      const sig = request.headers.get("X-Retell-Signature");
      const ok = await authorizeRetellRequest(raw, request, env);
      if (!ok) {
        const names = [...request.headers.keys()].filter((name) => /retell|sign|hmac|owner-interview/i.test(name));
        console.log("retell_sig", path, sig ? "mismatch" : "missing", names.join(",") || "none");
        return json({ error: "bad_signature", reason: sig ? "mismatch" : "missing" }, 401);
      }
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return json({ error: "bad_json" }, 400);
      }
      console.log(path === "/retell/tool" ? "retell_tool" : "retell_webhook", String(payload.event || payload.name || ""), metadataSessionId(payload));
      const sessionId = metadataSessionId(payload);
      if (sessionId) {
        const statusRes = await sessionStub(env, sessionId).fetch("https://do/status");
        const kind = statusRes.ok
          ? String(((await statusRes.json()) as { agent_kind?: string }).agent_kind || "owner")
          : null;
        if (!agentIdAllowed(env, agentIdOf(payload), kind)) {
          return path === "/retell/webhook" ? json({ ok: true }) : json({ error: "agent_mismatch" }, 401);
        }
      } else if (!agentIdAllowed(env, agentIdOf(payload))) {
        return path === "/retell/webhook" ? json({ ok: true }) : json({ error: "agent_mismatch" }, 401);
      }
      if (!sessionId) return json({ ok: true });
      const dest = path === "/retell/tool" ? "https://do/tool" : "https://do/webhook";
      const forwarded = await sessionStub(env, sessionId).fetch(
        new Request(dest, { method: "POST", body: raw, headers: { "Content-Type": "application/json" } }),
      );
      if (forwarded.status === 404) return json({ ok: true });
      return forwarded;
    }

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({ error: "not_found" }, 404);
  },
};

export default worker;
