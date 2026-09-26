import {
  ackLedger,
  appendLedger,
  applyResolve,
  applySeriesPatch,
  buildRecap,
  canPurgeSeries,
  createSeriesState,
  lastSessionDate,
  seriesExport,
  holdLedger,
  publicOrigin,
  purgeSeries,
  releaseLedger,
  resolveCycle,
  rotateLinkToken,
  seriesNextAlarm,
  seriesStatusView,
  unpulledExport,
  type SeriesState,
  type SessionView,
} from "./series-logic";

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export class Series {
  ctx: DurableObjectState;
  env: Env;
  constructor(ctx: DurableObjectState, env: Env) {
    this.ctx = ctx;
    this.env = env;
  }

  private async load(): Promise<SeriesState | null> {
    const state = (await this.ctx.storage.get("s")) as SeriesState | undefined;
    return state?.initialized ? state : null;
  }

  private async save(state: SeriesState, now = Date.now()): Promise<void> {
    await this.ctx.storage.put("s", state);
    const retention = Number(this.env.RETENTION_DAYS || 30);
    const alarmAt = seriesNextAlarm(state, now, retention);
    if (alarmAt != null) await this.ctx.storage.setAlarm(alarmAt);
  }

  private sessionStub(sessionId: string) {
    return this.env.SESSION.get(this.env.SESSION.idFromName(sessionId));
  }

  private async sessionView(sessionId: string): Promise<SessionView | null> {
    const res = await this.sessionStub(sessionId).fetch("https://do/status");
    if (!res.ok) return null;
    const view = (await res.json()) as { session_id?: string; status?: string; resumable?: boolean };
    return {
      session_id: String(view.session_id || sessionId),
      status: String(view.status || ""),
      resumable: Boolean(view.resumable),
    };
  }

  private async viewsFor(state: SeriesState): Promise<Record<string, SessionView>> {
    const out: Record<string, SessionView> = {};
    for (const cycle of state.cycles) {
      if (!cycle.session_id) continue;
      const view = await this.sessionView(cycle.session_id);
      if (view) out[cycle.session_id] = view;
    }
    return out;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const now = Number(url.searchParams.get("now") || Date.now());

    if (path === "/init" && request.method === "POST") {
      const payload = (await request.json()) as Record<string, unknown>;
      const existing = await this.load();
      if (existing && !existing.purged) {
        return json(seriesStatusView(existing, String(payload.origin || "https://host")));
      }
      const state = createSeriesState(payload, now);
      await this.save(state, now);
      return json(seriesStatusView(state, String(payload.origin || "https://host")));
    }

    const state = await this.load();
    if (!state) return json({ error: "not_found" }, 404);

    if (path === "/status") {
      const origin = publicOrigin(this.env.PUBLIC_ORIGIN, url.origin || "https://host");
      return json({
        ...seriesStatusView(state, origin),
        recap: buildRecap(state.ledger, 600),
        last_session_date: lastSessionDate(state),
      });
    }

    if (path === "/patch" && request.method === "POST") {
      const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      applySeriesPatch(state, payload, now);
      await this.save(state, now);
      const origin = publicOrigin(this.env.PUBLIC_ORIGIN, String(payload.origin || url.origin || "https://host"));
      return json(seriesStatusView(state, origin));
    }

    if (path === "/rotate-link" && request.method === "POST") {
      const rotated = rotateLinkToken(state, now);
      await this.save(state, now);
      const origin = publicOrigin(this.env.PUBLIC_ORIGIN, url.origin || "https://host");
      return json({ ...seriesStatusView(state, origin), previous_token: rotated.previous, link_token: rotated.next });
    }

    if (path === "/resolve") {
      if (state.purged) return json({ error: "purged", action: "purged", status: state.status }, 410);
      const probe = resolveCycle(state, now, null);
      const startIso = probe.mint?.starts_at || probe.cycle_starts_at;
      const cycle = startIso ? state.cycles.find((c) => c.starts_at === startIso) : undefined;
      const view = cycle?.session_id ? await this.sessionView(cycle.session_id) : null;
      const result = resolveCycle(state, now, view);
      if (result.action === "mint" && result.mint) {
        const sessionId = cryptoRandomHex(16);
        const expires = result.mint.expires_iso;
        const created = await this.sessionStub(sessionId).fetch(
          new Request("https://do/init", {
            method: "POST",
            body: JSON.stringify({
              session_id: sessionId,
              agent_kind: "expert",
              series_id: state.series_id,
              cycle_no: result.mint.cycle_no,
              agency_slug: state.agency_slug,
              campaign: state.campaign,
              company_name: state.company_name,
              agency_name: state.agency_name,
              owner_name: state.owner_name,
              speaker: state.speaker,
              topics: state.topics,
              answered_by: state.speaker,
              role: "spokesperson",
              expires,
              start_cap: Number(this.env.EXPERT_START_CAP || 8),
              origin: publicOrigin(this.env.PUBLIC_ORIGIN, url.origin || "https://host"),
            }),
          }),
        );
        if (!created.ok) return created;
        applyResolve(state, result, sessionId, now);
        await this.save(state, now);
        return json({
          ...result,
          action: "mint",
          session_id: sessionId,
          series_id: state.series_id,
          agency_slug: state.agency_slug,
          company_name: state.company_name,
          agency_name: state.agency_name,
          owner_name: state.owner_name,
          timezone: state.timezone,
        });
      }
      return json({
        ...result,
        series_id: state.series_id,
        agency_slug: state.agency_slug,
        company_name: state.company_name,
        agency_name: state.agency_name,
        owner_name: state.owner_name,
        timezone: state.timezone,
      });
    }

    if (path === "/export") {
      if (state.purged) return json({ error: "gone" }, 410);
      const views = await this.viewsFor(state);
      if (url.searchParams.get("unpulled") === "1") {
        const exported = unpulledExport(state, views);
        if (exported.status_code === 410) return json({ error: "gone" }, 410);
        return json(exported);
      }
      const sessions: Record<string, { consent?: unknown; calls?: { call_id: string; started_at?: string }[] }> = {};
      for (const cycle of state.cycles) {
        if (!cycle.session_id) continue;
        const exported = await this.sessionStub(cycle.session_id).fetch("https://do/export");
        if (exported.ok) sessions[cycle.session_id] = (await exported.json()) as { consent?: unknown; calls?: { call_id: string; started_at?: string }[] };
      }
      return json(seriesExport(state, sessions));
    }

    if (path === "/ack" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { call_ids?: string[] };
      const callIds = (body.call_ids || []).map(String);
      ackLedger(state, callIds);
      const affected = new Set(
        state.cycles.filter((c) => c.session_id).map((c) => c.session_id as string),
      );
      for (const sessionId of affected) {
        await this.sessionStub(sessionId).fetch(
          new Request("https://do/ack", { method: "POST", body: JSON.stringify({ call_ids: callIds }) }),
        );
      }
      await this.save(state, now);
      return json({ ok: true, call_ids: callIds });
    }

    if (path === "/ledger" && request.method === "POST") {
      const payload = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const result = appendLedger(
        state,
        {
          call_id: String(payload.call_id || ""),
          story_key: String(payload.story_key || ""),
          theme: payload.theme ? String(payload.theme) : undefined,
          headline: payload.headline ? String(payload.headline) : undefined,
          words: payload.words ? String(payload.words) : undefined,
          owner_slice: payload.owner_slice ? String(payload.owner_slice) : undefined,
          date: payload.date ? String(payload.date) : undefined,
          publish_decision: payload.publish_decision ? String(payload.publish_decision) : undefined,
          flags: Array.isArray(payload.flags) ? payload.flags.map(String) : undefined,
          pd_candidate: Boolean(payload.pd_candidate),
          speaker: payload.speaker ? String(payload.speaker) : undefined,
          cycle_no: payload.cycle_no != null ? Number(payload.cycle_no) : undefined,
        },
        now,
      );
      await this.save(state, now);
      return json(result);
    }

    if (path === "/ledger/hold" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { call_id?: string };
      holdLedger(state, String(body.call_id || ""));
      await this.save(state, now);
      return json({ ok: true });
    }

    if (path === "/ledger/release" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as { call_id?: string };
      releaseLedger(state, String(body.call_id || ""));
      await this.save(state, now);
      return json({ ok: true });
    }

    return json({ error: "not_found" }, 404);
  }

  async alarm(): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const now = Date.now();
    const retention = Number(this.env.RETENTION_DAYS || 30);
    if (canPurgeSeries(state, now, retention)) purgeSeries(state);
    await this.save(state, now);
  }
}

function cryptoRandomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}
