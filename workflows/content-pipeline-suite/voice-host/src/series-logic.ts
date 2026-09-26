import { FINISHED, RESUMABLE, randomHex } from "./session-logic";

export type CadenceFreq = "weekly" | "monthly";

export type SeriesCadence = {
  freq: CadenceFreq;
  interval: number;
  byday?: string;
  anchor_iso: string;
};

export type CycleState = "pending" | "open" | "finished" | "refused" | "expired";

export type SeriesCycle = {
  cycle_no: number;
  starts_at: string;
  session_id?: string;
  state: CycleState;
};

export type LedgerRow = {
  entry_id: string;
  call_id: string;
  story_key: string;
  theme?: string;
  headline?: string;
  words?: string;
  owner_slice?: string;
  date?: string;
  publish_decision?: string;
  flags?: string[];
  pd_candidate?: boolean;
  speaker?: string;
  cycle_no?: number;
  held: boolean;
  acked: boolean;
  created_at: string;
};

export type SeriesStatus = "active" | "paused" | "ended";

export type SeriesState = {
  initialized: boolean;
  series_id: string;
  link_token: string;
  agency_slug: string;
  campaign: string;
  company_name: string;
  agency_name: string;
  owner_name: string;
  speaker: string;
  spokesperson_email: string;
  timezone: string;
  cadence: SeriesCadence;
  status: SeriesStatus;
  ended_at?: string;
  steering_enabled: boolean;
  topics: string[];
  cycles: SeriesCycle[];
  ledger: LedgerRow[];
  created_at: string;
  updated_at: string;
  purged?: boolean;
};

export type SessionView = {
  session_id: string;
  status: string;
  resumable: boolean;
};

export type ResolveResult = {
  action: "resume" | "mint" | "next_date" | "paused" | "ended" | "purged";
  status: SeriesStatus;
  cycle_no?: number;
  cycle_starts_at?: string;
  session_id?: string;
  next_date?: string;
  mint?: { cycle_no: number; starts_at: string; expires_iso: string };
};

export type UnpulledCall = {
  call_id: string;
  live: boolean;
  stories: LedgerRow[];
};

export type UnpulledExport = {
  series_id: string;
  status: SeriesStatus;
  status_code?: number;
  cycles: { cycle_no: number; session_id?: string; calls: UnpulledCall[] }[];
};

const REQUIRED_CREATE = [
  "timezone",
  "agency_slug",
  "campaign",
  "company_name",
  "agency_name",
  "spokesperson_email",
  "owner_name",
] as const;

const LIVE_SESSION = new Set(["in_progress", "consent_pending", "connecting"]);

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function zonedParts(ms: number, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function offsetMs(atUtc: number, timeZone: string): number {
  const p = zonedParts(atUtc, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - atUtc;
}

export function zonedLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  let utc = guess - offsetMs(guess, timeZone);
  utc = guess - offsetMs(utc, timeZone);
  return utc;
}

function addDays(parts: ZonedParts, days: number): ZonedParts {
  const utc = Date.UTC(parts.year, parts.month - 1, parts.day + days, parts.hour, parts.minute, parts.second);
  return {
    year: new Date(utc).getUTCFullYear(),
    month: new Date(utc).getUTCMonth() + 1,
    day: new Date(utc).getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function addMonths(parts: ZonedParts, months: number): ZonedParts {
  const targetMonthIndex = parts.month - 1 + months;
  const year = parts.year + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const dim = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return {
    year,
    month: month + 1,
    day: Math.min(parts.day, dim),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

function partsToUtc(parts: ZonedParts, timeZone: string): number {
  return zonedLocalToUtc(parts.year, parts.month, parts.day, parts.hour, parts.minute, timeZone);
}

function dateKey(parts: ZonedParts): number {
  return Date.UTC(parts.year, parts.month - 1, parts.day);
}

function monthsBetween(a: ZonedParts, b: ZonedParts): number {
  return (b.year - a.year) * 12 + (b.month - a.month);
}

const BYDAY_DOW: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const BYDAY_SLOT_HOUR = 9;
const BYDAY_SLOT_MINUTE = 0;

function parseCadence(raw: unknown, now: number): SeriesCadence {
  const value = (raw || {}) as Record<string, unknown>;
  const freq = value.freq === "monthly" ? "monthly" : "weekly";
  const interval = Math.max(1, Number(value.interval || (freq === "weekly" && value.freq == null ? 2 : 1)));
  return {
    freq,
    interval: raw == null ? 2 : interval,
    byday: value.byday ? String(value.byday) : undefined,
    anchor_iso: value.anchor_iso ? String(value.anchor_iso) : new Date(now).toISOString(),
  };
}

function parseByday(raw: string | undefined): { nth: number; dow: number } | null {
  const match = /^(-?[1-4])?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(String(raw || "").trim());
  if (!match) return null;
  return { nth: match[1] ? Number(match[1]) : 1, dow: BYDAY_DOW[match[2].toUpperCase()] };
}

function nthWeekdayOfMonth(year: number, month: number, dow: number, nth: number): number {
  if (nth < 0) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDow = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
    return last - ((lastDow - dow + 7) % 7);
  }
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((dow - firstDow + 7) % 7) + (nth - 1) * 7;
}

/** Minute-precision anchor so cycle starts match stored `starts_at` (seconds stripped). */
export function normalizedAnchorMs(cadence: SeriesCadence, timeZone: string): number {
  const raw = Date.parse(cadence.anchor_iso);
  if (!Number.isFinite(raw)) return NaN;
  const parts = zonedParts(raw, timeZone);
  return partsToUtc({ ...parts, second: 0 }, timeZone);
}

function bydayOccurrenceMs(
  year: number,
  month: number,
  byday: string,
  timeZone: string,
  hour = BYDAY_SLOT_HOUR,
  minute = BYDAY_SLOT_MINUTE,
): number | null {
  const parsed = parseByday(byday);
  if (!parsed) return null;
  const day = nthWeekdayOfMonth(year, month, parsed.dow, parsed.nth);
  const dim = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > dim) return null;
  return zonedLocalToUtc(year, month, day, hour, minute, timeZone);
}

/** First monthly BYDAY slot strictly after `afterMs` (09:00 company time, same as calendar). */
export function nextBydayAfter(cadence: SeriesCadence, timeZone: string, afterMs: number): number {
  const interval = Math.max(1, cadence.interval || 1);
  let { year, month } = zonedParts(afterMs, timeZone);
  for (let i = 0; i < 24; i += 1) {
    const ms = bydayOccurrenceMs(year, month, String(cadence.byday || ""), timeZone);
    if (ms != null && ms > afterMs) return ms;
    const next = addMonths({ year, month, day: 1, hour: 0, minute: 0, second: 0 }, interval);
    year = next.year;
    month = next.month;
  }
  return afterMs;
}

export function currentCycleStartMs(cadence: SeriesCadence, timeZone: string, now: number): number | null {
  const anchorMs = normalizedAnchorMs(cadence, timeZone);
  if (!Number.isFinite(anchorMs)) return null;
  if (now < anchorMs) return null;
  const interval = Math.max(1, cadence.interval || 1);
  const anchor = zonedParts(anchorMs, timeZone);
  const clock = { hour: anchor.hour, minute: anchor.minute };
  if (cadence.freq === "monthly" && parseByday(cadence.byday)) {
    let start = anchorMs;
    for (let i = 0; i < 24; i += 1) {
      const next = nextBydayAfter(cadence, timeZone, start);
      if (next > now) return start;
      start = next;
    }
    return start;
  }
  if (cadence.freq === "monthly") {
    const nowP = zonedParts(now, timeZone);
    let k = Math.floor(monthsBetween(anchor, nowP) / interval) * interval;
    let start = addMonths({ ...anchor, ...clock }, k);
    let startMs = partsToUtc(start, timeZone);
    if (startMs > now) {
      start = addMonths(start, -interval);
      startMs = partsToUtc(start, timeZone);
    }
    return startMs;
  }
  const nowP = zonedParts(now, timeZone);
  const days = Math.round((dateKey(nowP) - dateKey(anchor)) / 86400000);
  const weeks = Math.floor(days / 7);
  let k = Math.floor(weeks / interval) * interval;
  let start = addDays({ ...anchor, ...clock }, k * 7);
  let startMs = partsToUtc(start, timeZone);
  if (startMs > now) {
    start = addDays(start, -interval * 7);
    startMs = partsToUtc(start, timeZone);
  }
  return startMs;
}

export function nextCycleStartMs(cadence: SeriesCadence, timeZone: string, after: number): number {
  const interval = Math.max(1, cadence.interval || 1);
  const current = currentCycleStartMs(cadence, timeZone, after);
  const first = normalizedAnchorMs(cadence, timeZone);
  if (current == null) return Number.isFinite(first) ? first : Date.parse(cadence.anchor_iso);
  if (cadence.freq === "monthly" && parseByday(cadence.byday)) {
    return nextBydayAfter(cadence, timeZone, current);
  }
  const base = zonedParts(current, timeZone);
  if (cadence.freq === "monthly") {
    return partsToUtc(addMonths(base, interval), timeZone);
  }
  return partsToUtc(addDays(base, interval * 7), timeZone);
}

function cycleEndMs(cadence: SeriesCadence, timeZone: string, startMs: number): number {
  return nextCycleStartMs(cadence, timeZone, startMs);
}

function cycleForStart(state: SeriesState, startIso: string): SeriesCycle | undefined {
  return state.cycles.find((c) => c.starts_at === startIso);
}

function nextCycleNo(state: SeriesState): number {
  return state.cycles.reduce((max, c) => Math.max(max, c.cycle_no), 0) + 1;
}

function sessionRefused(view: SessionView | null | undefined): boolean {
  return view?.status === "consent_refused";
}

function sessionFinished(view: SessionView | null | undefined, cycle?: SeriesCycle): boolean {
  if (cycle?.state === "finished" || cycle?.state === "refused") return true;
  if (!view) return false;
  if (sessionRefused(view)) return true;
  return FINISHED.has(view.status) && view.status !== "expired";
}

export function resolveCycle(state: SeriesState, now: number, session: SessionView | null = null): ResolveResult {
  if (state.purged) return { action: "purged", status: state.status };
  if (state.status === "ended") return { action: "ended", status: "ended" };
  if (state.status === "paused") return { action: "paused", status: "paused" };

  const startMs = currentCycleStartMs(state.cadence, state.timezone, now);
  if (startMs == null) {
    const first = normalizedAnchorMs(state.cadence, state.timezone);
    return {
      action: "next_date",
      status: state.status,
      next_date: Number.isFinite(first) ? new Date(first).toISOString() : state.cadence.anchor_iso,
    };
  }

  const startIso = new Date(startMs).toISOString();
  const cycle = cycleForStart(state, startIso);
  const nextIso = new Date(nextCycleStartMs(state.cadence, state.timezone, startMs)).toISOString();
  const view = session && cycle?.session_id && session.session_id === cycle.session_id ? session : session;

  if (cycle?.session_id) {
    const used = view && view.session_id === cycle.session_id ? view : session;
    if (used && RESUMABLE.has(used.status) && used.resumable) {
      return {
        action: "resume",
        status: state.status,
        cycle_no: cycle.cycle_no,
        cycle_starts_at: startIso,
        session_id: cycle.session_id,
      };
    }
    if (sessionRefused(used) || cycle.state === "refused") {
      return { action: "next_date", status: state.status, cycle_no: cycle.cycle_no, next_date: nextIso };
    }
    if (sessionFinished(used, cycle) || used?.status === "expired" || cycle.state === "expired") {
      return { action: "next_date", status: state.status, cycle_no: cycle.cycle_no, next_date: nextIso };
    }
  }

  const cycleNo = cycle?.cycle_no || nextCycleNo(state);
  const expires = cycleEndMs(state.cadence, state.timezone, startMs) + 86400000;
  return {
    action: "mint",
    status: state.status,
    cycle_no: cycleNo,
    cycle_starts_at: startIso,
    mint: {
      cycle_no: cycleNo,
      starts_at: startIso,
      expires_iso: new Date(expires).toISOString(),
    },
  };
}

export function applyResolve(state: SeriesState, result: ResolveResult, sessionId: string, now: number): SeriesState {
  if (result.action !== "mint" || !result.mint) return state;
  const existing = cycleForStart(state, result.mint.starts_at);
  if (existing) {
    existing.session_id = sessionId;
    existing.state = "open";
  } else {
    state.cycles.push({
      cycle_no: result.mint.cycle_no,
      starts_at: result.mint.starts_at,
      session_id: sessionId,
      state: "open",
    });
  }
  state.updated_at = new Date(now).toISOString();
  return state;
}

export function validateSeriesCreate(
  payload: Record<string, unknown>,
): { ok: true } | { ok: false; status: 400; field: string; error: string } {
  for (const field of REQUIRED_CREATE) {
    if (!String(payload[field] || "").trim()) {
      return { ok: false, status: 400, field, error: "missing_field" };
    }
  }
  return { ok: true };
}

export function createSeriesState(
  payload: Record<string, unknown>,
  now: number,
  extra: Partial<SeriesState> = {},
): SeriesState {
  const cadence = parseCadence(payload.cadence, now);
  const owner = String(payload.owner_name || payload.speaker || "");
  const created: SeriesState = {
    initialized: true,
    series_id: String(payload.series_id || ""),
    link_token: String(payload.link_token || ""),
    agency_slug: String(payload.agency_slug || "").toLowerCase(),
    campaign: String(payload.campaign || ""),
    company_name: String(payload.company_name || ""),
    agency_name: String(payload.agency_name || ""),
    owner_name: owner,
    speaker: String(payload.speaker || owner),
    spokesperson_email: String(payload.spokesperson_email || ""),
    timezone: String(payload.timezone || ""),
    cadence,
    status: extra.status || "active",
    ended_at: extra.ended_at,
    steering_enabled: Boolean(payload.steering_enabled ?? extra.steering_enabled ?? false),
    topics: Array.isArray(payload.topics) ? (payload.topics as string[]).map(String) : extra.topics || [],
    cycles: extra.cycles || [],
    ledger: extra.ledger || [],
    created_at: extra.created_at || new Date(now).toISOString(),
    updated_at: extra.updated_at || new Date(now).toISOString(),
    purged: extra.purged,
  };
  return Object.assign(created, extra, { cadence: extra.cadence || created.cadence });
}

export function reanchorCadence(
  state: SeriesState,
  next: Partial<SeriesCadence>,
  now: number,
): SeriesState {
  const merged: SeriesCadence = {
    freq: next.freq || state.cadence.freq,
    interval: next.interval ?? state.cadence.interval,
    byday: next.byday ?? state.cadence.byday,
    anchor_iso: state.cadence.anchor_iso,
  };
  const nextStart = nextCycleStartMs(merged, state.timezone, now);
  state.cadence = { ...merged, anchor_iso: new Date(nextStart).toISOString() };
  state.updated_at = new Date(now).toISOString();
  return state;
}

export function applySeriesPatch(state: SeriesState, patch: Record<string, unknown>, now: number): SeriesState {
  if (patch.cadence && typeof patch.cadence === "object") {
    reanchorCadence(state, patch.cadence as Partial<SeriesCadence>, now);
  }
  if (patch.status === "paused" || patch.status === "active" || patch.status === "ended") {
    state.status = patch.status;
    if (patch.status === "ended") state.ended_at = new Date(now).toISOString();
    if (patch.status === "active") state.ended_at = undefined;
  }
  if (Array.isArray(patch.topics)) state.topics = (patch.topics as unknown[]).map(String);
  if (patch.steering_enabled != null) state.steering_enabled = Boolean(patch.steering_enabled);
  state.updated_at = new Date(now).toISOString();
  return state;
}

export function rotateLinkToken(state: SeriesState, now: number): { previous: string; next: string } {
  const previous = state.link_token;
  let next = randomHex(16);
  while (next === state.series_id || next === previous) next = randomHex(16);
  state.link_token = next;
  state.updated_at = new Date(now).toISOString();
  return { previous, next };
}

export function seriesLink(origin: string, agencySlug: string, token: string): string {
  return `${origin.replace(/\/$/, "")}/e/${agencySlug}/${token}`;
}

export function publicOrigin(envOrigin: string | undefined, requestOrigin: string): string {
  const configured = String(envOrigin || "").trim();
  return configured || requestOrigin;
}

export function tokenIndexKey(agencySlug: string, token: string): string {
  return `series-token:${agencySlug.toLowerCase()}:${token}`;
}

export function appendLedger(
  state: SeriesState,
  story: {
    call_id: string;
    story_key: string;
    theme?: string;
    headline?: string;
    words?: string;
    owner_slice?: string;
    date?: string;
    publish_decision?: string;
    flags?: string[];
    pd_candidate?: boolean;
    speaker?: string;
    cycle_no?: number;
  },
  now: number,
): { ok: true; already_reported?: boolean; entry_id: string } {
  const callId = String(story.call_id || "");
  const key = String(story.story_key || "");
  const existing = state.ledger.find((row) => row.call_id === callId && row.story_key === key);
  if (existing) return { ok: true, already_reported: true, entry_id: existing.entry_id };
  const index = state.ledger.filter((row) => row.call_id === callId).length + 1;
  const row: LedgerRow = {
    entry_id: `${callId}-${index}`,
    call_id: callId,
    story_key: key,
    theme: story.theme,
    headline: story.headline,
    words: story.words,
    owner_slice: story.owner_slice,
    date: story.date,
    publish_decision: story.publish_decision,
    flags: story.flags,
    pd_candidate: story.pd_candidate,
    speaker: story.speaker || state.speaker,
    cycle_no: story.cycle_no,
    held: false,
    acked: false,
    created_at: new Date(now).toISOString(),
  };
  state.ledger.push(row);
  state.updated_at = row.created_at;
  return { ok: true, entry_id: row.entry_id };
}

export function holdLedger(state: SeriesState, callId: string): SeriesState {
  for (const row of state.ledger) if (row.call_id === callId) row.held = true;
  return state;
}

export function releaseLedger(state: SeriesState, callId: string): SeriesState {
  for (const row of state.ledger) if (row.call_id === callId) row.held = false;
  return state;
}

export function ackLedger(state: SeriesState, callIds: string[]): string[] {
  const acked: string[] = [];
  for (const id of callIds) {
    for (const row of state.ledger) {
      if (row.call_id === id) {
        row.acked = true;
        if (!acked.includes(id)) acked.push(id);
      }
    }
  }
  return acked;
}

export function unpulledExport(state: SeriesState, sessions: Record<string, SessionView>): UnpulledExport {
  if (state.purged) {
    return { series_id: state.series_id, status: state.status, status_code: 410, cycles: [] };
  }
  const byCall = new Map<string, LedgerRow[]>();
  for (const row of state.ledger) {
    const list = byCall.get(row.call_id) || [];
    list.push(row);
    byCall.set(row.call_id, list);
  }
  const cycles: UnpulledExport["cycles"] = [];
  for (const cycle of state.cycles) {
    const view = cycle.session_id ? sessions[cycle.session_id] : undefined;
    const live = Boolean(view && LIVE_SESSION.has(view.status));
    const callIds = [...byCall.keys()].filter((id) => {
      const rows = byCall.get(id) || [];
      return rows.some((row) => row.cycle_no === cycle.cycle_no || (!row.cycle_no && cycle.session_id));
    });
    // Rows minted without cycle_no still belong to the cycle that owned the session at append time.
    const sessionCallIds = [...byCall.keys()].filter((id) => {
      const rows = byCall.get(id) || [];
      return rows.some((row) => row.cycle_no == null || row.cycle_no === cycle.cycle_no);
    });
    const ids = cycle.session_id ? sessionCallIds : callIds;
    const calls: UnpulledCall[] = [];
    for (const callId of ids) {
      const rows = byCall.get(callId) || [];
      const unacked = rows.some((row) => !row.acked);
      if (!unacked) continue;
      if (live) {
        calls.push({ call_id: callId, live: true, stories: [] });
      } else {
        calls.push({ call_id: callId, live: false, stories: rows.filter((row) => !row.acked) });
      }
    }
    if (calls.length) cycles.push({ cycle_no: cycle.cycle_no, session_id: cycle.session_id, calls });
  }
  if (!state.cycles.length) {
    const calls: UnpulledCall[] = [];
    for (const [callId, rows] of byCall) {
      if (rows.every((row) => row.acked)) continue;
      calls.push({ call_id: callId, live: false, stories: rows.filter((row) => !row.acked) });
    }
    if (calls.length) cycles.push({ cycle_no: 0, calls });
  }
  return { series_id: state.series_id, status: state.status, cycles };
}

export function canPurgeSeries(state: SeriesState, now: number, retentionDays: number): boolean {
  if (state.purged || state.status !== "ended" || !state.ended_at) return false;
  if (state.ledger.some((row) => !row.acked)) return false;
  const due = Date.parse(state.ended_at) + retentionDays * 86400000;
  return now >= due;
}

export function purgeSeries(state: SeriesState): SeriesState {
  state.purged = true;
  state.ledger = [];
  state.topics = [];
  state.spokesperson_email = "";
  state.owner_name = "";
  state.speaker = "";
  return state;
}

export function seriesNextAlarm(state: SeriesState, now: number, retentionDays: number): number | null {
  if (state.purged) return null;
  if (state.status === "ended" && state.ended_at && state.ledger.every((row) => row.acked)) {
    const due = Date.parse(state.ended_at) + retentionDays * 86400000;
    return due > now ? due : now;
  }
  return null;
}

function wordCount(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function takeWords(text: string, max: number): string {
  const parts = String(text || "").trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, max).join(" ");
}

function storyDate(row: LedgerRow): string {
  const raw = row.date || row.created_at || "";
  return raw.slice(0, 10);
}

export function buildRecap(ledger: LedgerRow[], budgetWords = 600): string {
  const usable = ledger.filter((row) => !row.held);
  if (!usable.length) return "";
  const cycles = new Map<number, LedgerRow[]>();
  for (const row of usable) {
    const key = Number(row.cycle_no || 0);
    const list = cycles.get(key) || [];
    list.push(row);
    cycles.set(key, list);
  }
  const ordered = [...cycles.keys()].sort((a, b) => b - a);
  const newest = ordered[0];
  const lines: { text: string; droppable: boolean }[] = [];
  for (const cycleNo of ordered) {
    for (const row of cycles.get(cycleNo) || []) {
      const internal = row.publish_decision === "internal";
      if (cycleNo === newest && !internal) {
        lines.push({ text: takeWords(row.words || row.headline || "", 80), droppable: false });
      } else {
        lines.push({ text: `${storyDate(row)} — ${row.headline || ""}`.trim(), droppable: cycleNo !== newest });
      }
    }
  }
  const kept = [...lines];
  const dropped: typeof lines = [];
  while (wordCount(kept.map((l) => l.text).join(" ")) > budgetWords) {
    let idx = -1;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].droppable) {
        idx = i;
        break;
      }
    }
    if (idx < 0) idx = kept.length - 1;
    if (idx < 0) break;
    dropped.unshift(kept.splice(idx, 1)[0]);
  }
  const body = kept.map((l) => l.text).filter(Boolean).join(" ");
  if (!dropped.length) return body;
  return `${body} (+${dropped.length} earlier stories)`.trim();
}

export function lastSessionDate(state: SeriesState): string {
  const finished = state.cycles.filter((c) => c.state === "finished" || c.state === "refused");
  const last = finished.at(-1) || state.cycles.filter((c) => c.session_id).at(-1);
  return last?.starts_at ? last.starts_at.slice(0, 10) : "";
}

export function seriesExport(
  state: SeriesState,
  sessions: Record<string, { consent?: unknown; calls?: { call_id: string; started_at?: string }[] }>,
): Record<string, unknown> {
  return {
    series_id: state.series_id,
    cycles: state.cycles.map((cycle) => {
      const session = cycle.session_id ? sessions[cycle.session_id] : undefined;
      const rows = state.ledger.filter((row) => row.cycle_no === cycle.cycle_no || (!row.cycle_no && cycle.session_id));
      const callIds = [...new Set(rows.map((row) => row.call_id))];
      return {
        cycle_no: cycle.cycle_no,
        session_id: cycle.session_id,
        calls: callIds.map((callId) => {
          const sessionCall = session?.calls?.find((c) => c.call_id === callId);
          return {
            call_id: callId,
            started_at: sessionCall?.started_at,
            consent: session?.consent,
            stories: rows.filter((row) => row.call_id === callId),
          };
        }),
      };
    }),
  };
}

export function seriesStatusView(state: SeriesState, origin: string): Record<string, unknown> {
  return {
    series_id: state.series_id,
    link_token: state.link_token,
    url: seriesLink(origin, state.agency_slug, state.link_token),
    agency_slug: state.agency_slug,
    campaign: state.campaign,
    company_name: state.company_name,
    agency_name: state.agency_name,
    owner_name: state.owner_name,
    speaker: state.speaker,
    spokesperson_email: state.purged ? "" : state.spokesperson_email,
    timezone: state.timezone,
    cadence: state.cadence,
    status: state.status,
    ended_at: state.ended_at,
    steering_enabled: state.steering_enabled,
    topics: state.topics,
    cycles: state.cycles,
    created_at: state.created_at,
    updated_at: state.updated_at,
    purged: Boolean(state.purged),
  };
}

export function distinctSeriesIds(): { series_id: string; link_token: string } {
  const series_id = randomHex(16);
  let link_token = randomHex(16);
  while (link_token === series_id) link_token = randomHex(16);
  return { series_id, link_token };
}
