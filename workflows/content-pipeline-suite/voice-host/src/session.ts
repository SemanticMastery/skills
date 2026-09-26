import { deleteCall, getCallStatus, stopCall } from "./retell";
import {
  ackCalls,
  applyDisplayNames,
  applyStaleEnd,
  dropIfVendorEnded,
  openCallId,
  applyTap,
  bindCall,
  canPurge,
  canStart,
  DELETE_BACKOFF_MS,
  expireIfNeeded,
  expireSession,
  exportSession,
  handleTool,
  handleWebhook,
  expertStartVars,
  initSession,
  issueStart,
  logAccess,
  markOpened,
  recordRelease,
  VOICE_DURATION_MS,
  recordStoryCount,
  nextAlarm,
  pageTokenOk,
  purge,
  questionCard,
  sessionServiceTitle,
  statusView,
  type SessionState,
} from "./session-logic";
import { timeCapForCadence } from "./time-cap";

export class InterviewSession {
  ctx: DurableObjectState;
  env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  private async load(): Promise<SessionState | null> {
    const state = (await this.ctx.storage.get("s")) as SessionState | undefined;
    return state?.initialized ? state : null;
  }

  private async save(state: SessionState, now = Date.now()): Promise<void> {
    await this.ctx.storage.put("s", state);
    const alarmAt = nextAlarm(state, now);
    if (alarmAt != null) await this.ctx.storage.setAlarm(alarmAt);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Date.now();

    if (path === "/init" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const existing = await this.load();
      if (existing) {
        expireIfNeeded(existing, now);
        if (existing.status !== "purged") {
          return Response.json(statusView(existing, String(payload.origin || "https://host")));
        }
      }
      const state = initSession(payload, this.env, now);
      await this.save(state, now);
      return Response.json(statusView(state, String(payload.origin || "https://host")));
    }

    const state = await this.load();
    if (!state) return Response.json({ error: "not_found" }, { status: 404 });
    expireIfNeeded(state, now);

    if (path === "/expire" && request.method === "POST") {
      expireSession(state, now);
      await this.save(state, now);
      return Response.json(statusView(state, url.origin || "https://host"));
    }
    if (path === "/status") return Response.json(statusView(state, url.origin || "https://host"));
    if (path === "/labels" && request.method === "POST") {
      const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      applyDisplayNames(state, payload);
      await this.save(state, now);
      return Response.json(statusView(state, String(payload.origin || "https://host")));
    }
    if (path === "/export") return Response.json(exportSession(state));
    if (path === "/export") return Response.json(exportSession(state));
    if (path === "/page") {
      markOpened(state);
      logAccess(state, "page_open", now);
      await this.save(state, now);
      return Response.json({
        session_id: state.session_id,
        status: state.status,
        agent_kind: state.agent_kind || "owner",
        agency_slug: state.agency_slug || "",
        agency_name: state.agency_name,
        company_name: state.company_name,
        owner_name: state.owner_name,
        service_title: sessionServiceTitle(state),
        notice_version: state.notice_version,
        released: Boolean(state.release),
        finished: !["created", "opened", "connecting", "consent_pending", "in_progress", "dropped", "ended_early"].includes(
          state.status,
        ),
      });
    }
    if (path === "/release" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { name?: string };
      const result = recordRelease(state, String(body.name || ""), now);
      if (!result.ok) return Response.json({ error: result.error }, { status: result.http });
      await this.save(state, now);
      return Response.json({ ok: true, released: true, notice_version: state.notice_version });
    }
    if (path === "/ack" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { call_ids?: string[]; accept_withdrawn?: boolean };
      const result = ackCalls(state, body.call_ids || [], Boolean(body.accept_withdrawn));
      await this.save(state, now);
      return Response.json({ ok: true, ...result });
    }
    if (path === "/start" && request.method === "POST") {
      let gate = canStart(state, now);
      if (!gate.ok && gate.error === "call_active") {
        const openId = openCallId(state);
        if (openId) {
          const live = await getCallStatus(this.env, openId);
          dropIfVendorEnded(state, String(live?.call_status || ""), now);
          gate = canStart(state, now);
        }
      }
      if (!gate.ok) return Response.json({ error: gate.error }, { status: gate.http });
      const issued = issueStart(state, now);
      logAccess(state, "call_start", now);
      let expertCadence: { freq?: string; interval?: number } | null = null;
      if (state.agent_kind === "expert" && state.series_id) {
        const seriesRes = await this.env.SERIES.get(this.env.SERIES.idFromName(state.series_id)).fetch("https://do/status");
        if (seriesRes.ok) {
          const series = (await seriesRes.json()) as {
            recap?: string;
            topics?: string[];
            last_session_date?: string;
            cadence?: { freq?: string; interval?: number };
          };
          expertCadence = series.cadence || null;
          Object.assign(issued.vars, expertStartVars(state, series));
        } else {
          Object.assign(issued.vars, expertStartVars(state));
        }
      } else if (state.agent_kind === "expert") {
        Object.assign(issued.vars, expertStartVars(state));
      }
      await this.save(state, now);
      const max_call_duration_ms =
        state.agent_kind === "expert"
          ? timeCapForCadence(expertCadence).max_ms
          : state.agent_kind === "voice"
            ? VOICE_DURATION_MS
            : undefined;
      const res = Response.json({
        vars: issued.vars,
        session_id: state.session_id,
        agent_kind: state.agent_kind || "owner",
        ...(max_call_duration_ms ? { max_call_duration_ms } : {}),
      });
      res.headers.set("X-Page-Token", issued.page_token);
      return res;
    }
    if (path === "/revert-opened" && request.method === "POST") {
      if (state.status === "connecting" && !state.current_call_id) {
        state.status = "opened";
        state.start_count = Math.max(0, state.start_count - 1);
        state.page_token = null;
        await this.save(state, now);
      }
      return Response.json({ ok: true, status: state.status });
    }
    if (path === "/bind" && request.method === "POST") {
      const body = (await request.json()) as { call_id?: string };
      if (body.call_id) bindCall(state, body.call_id, now);
      await this.save(state, now);
      return Response.json({ ok: true });
    }
    if (path === "/q" && request.method === "GET") {
      const token = request.headers.get("X-Page-Token");
      if (!pageTokenOk(state, token)) return Response.json({ error: "unauthorized" }, { status: 401 });
      return Response.json(questionCard(state));
    }
    if (path === "/tap" && request.method === "POST") {
      const token = request.headers.get("X-Page-Token");
      if (!pageTokenOk(state, token)) return Response.json({ error: "unauthorized" }, { status: 401 });
      const body = (await request.json().catch(() => ({}))) as { question_id?: string; value?: string };
      const result = applyTap(state, String(body.question_id || ""), String(body.value || ""), now);
      await this.save(state, now);
      if (!result.ok) return Response.json({ error: "tap_rejected" }, { status: 400 });
      return Response.json({ ok: true, value: result.value });
    }
    if (path === "/tool" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const result = handleTool(state, payload, now);
      if (result.pending_ledger && result.story && state.series_id) {
        const story = result.story as Record<string, unknown>;
        const ledgerRes = await this.env.SERIES.get(this.env.SERIES.idFromName(state.series_id)).fetch(
          new Request("https://do/ledger", { method: "POST", body: JSON.stringify(story) }),
        );
        if (!ledgerRes.ok) {
          await this.save(state, now);
          return Response.json({ ok: false, error: "ledger_unavailable" });
        }
        const ledger = (await ledgerRes.json()) as { ok?: boolean; already_reported?: boolean; entry_id?: string };
        if (ledger.already_reported) {
          await this.save(state, now);
          return Response.json({ ok: true, already_reported: true, entry_id: ledger.entry_id });
        }
        recordStoryCount(state, String(story.call_id || ""), Number(result.next_count || 1));
        await this.save(state, now);
        return Response.json({ ok: true, entry_id: ledger.entry_id });
      }
      if (result.pending_ledger && !state.series_id) {
        await this.save(state, now);
        return Response.json({ ok: false, error: "ledger_unavailable" });
      }
      await this.save(state, now);
      if (state.status === "consent_refused") {
        const cid = state.current_call_id;
        if (cid) this.ctx.waitUntil(stopCall(this.env, cid).catch(() => undefined));
      }
      if (state.status === "consent_withdrawn" && state.series_id && state.current_call_id) {
        this.ctx.waitUntil(
          this.env.SERIES.get(this.env.SERIES.idFromName(state.series_id))
            .fetch(new Request("https://do/ledger/hold", { method: "POST", body: JSON.stringify({ call_id: state.current_call_id }) }))
            .catch(() => undefined),
        );
      }
      return Response.json(result);
    }
    if (path === "/webhook" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      handleWebhook(state, payload, now);
      await this.save(state, now);
      if (state.status === "consent_refused" && state.delete_queue.length) {
        this.ctx.waitUntil(this.drainDeletes(state));
      }
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const now = Date.now();
    expireIfNeeded(state, now);
    if (state.stale_due != null && now >= state.stale_due && state.current_call_id) {
      const live = await getCallStatus(this.env, state.current_call_id);
      const status = live?.call_status || "";
      if (!live || status === "ended" || status === "error") applyStaleEnd(state, now);
      else state.stale_due = now + 60_000;
    }
    if (state.delete_due != null && now >= state.delete_due && state.delete_queue.length) {
      await this.drainDeletes(state);
    }
    if (canPurge(state, now)) purge(state);
    await this.save(state, now);
  }

  private async drainDeletes(state: SessionState): Promise<void> {
    const remain: string[] = [];
    for (const id of state.delete_queue) {
      const res = await deleteCall(this.env, id).catch(() => null);
      if (!res || !res.ok) remain.push(id);
    }
    state.delete_queue = remain;
    if (remain.length) {
      const attempt = remain.length;
      const wait = DELETE_BACKOFF_MS[Math.min(attempt, DELETE_BACKOFF_MS.length - 1)];
      state.delete_due = Date.now() + wait;
    } else {
      state.delete_due = null;
    }
  }
}

export class SessionIndex {
  ctx: DurableObjectState;
  env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      const value = (await this.ctx.storage.get(key)) as { session_id?: string } | undefined;
      return Response.json(value || {});
    }
    const body = (await request.json()) as { key?: string; session_id?: string; series_id?: string; unbind?: boolean };
    if (body.key && body.unbind) {
      await this.ctx.storage.delete(body.key);
      return Response.json({ ok: true });
    }
    const id = body.series_id || body.session_id;
    if (body.key && id) await this.ctx.storage.put(body.key, { session_id: id, series_id: id });
    return Response.json({ ok: true });
  }
}
