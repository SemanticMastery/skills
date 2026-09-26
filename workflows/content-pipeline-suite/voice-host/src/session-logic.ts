import { AFFIRMATIVE, hasAffirmative, latestOwnerTurn, ownerSlice, type TranscriptTurn } from "./grounding-window";
import { timeCapForCadence } from "./time-cap";

export const NOTICE_VERSION = "notice-v1";
export const VOICE_NOTICE_VERSION = "voice-notice-v1";
export const VOICE_DURATION_MS = 2_700_000;
export const VOICE_LINK_DAYS = 2;
export const PUBLISH_ENUM = ["public", "framing-only", "internal"] as const;
export const RESUMABLE = new Set([
  "created",
  "opened",
  "connecting",
  "consent_pending",
  "in_progress",
  "dropped",
  "ended_early",
]);
export const FINISHED = new Set([
  "completed",
  "consent_refused",
  "consent_withdrawn",
  "expired",
  "purged",
]);
export const STORY_FLAGS = ["publish_unclear", "sensitive", "pd_candidate"] as const;
export const STALE_MS = 10 * 60 * 1000;
export const DELETE_BACKOFF_MS = [60_000, 5 * 60_000, 30 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];

export function displayLabel(value: string): string {
  return String(value || "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function titleCaseLabel(value: string): string {
  return displayLabel(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** People-facing title for the `company` interview scope. Not "Company-wide". */
export const COMPANY_SCOPE_TITLE = "Company Details";

function isLegacyCompanyTitle(value: string): boolean {
  return /^(company[- ]wide|company wide)$/i.test(String(value || "").trim());
}

/** People-facing offering name. `company` is Company Details, not a service page. */
export function serviceTitle(scope: string, explicit?: string | null): string {
  const named = String(explicit || "").trim();
  if (named) {
    if (isLegacyCompanyTitle(named) || /^company$/i.test(named)) return COMPANY_SCOPE_TITLE;
    return displayLabel(named);
  }
  const slug = String(scope || "").trim().toLowerCase();
  if (!slug || slug === "company") return COMPANY_SCOPE_TITLE;
  return titleCaseLabel(slug);
}

export function sessionServiceTitle(state: { scope?: string; service_title?: string }): string {
  return serviceTitle(state.scope || "", state.service_title);
}

/** True only for an owner service interview that has not stored an answer yet. */
export function companyDetailsFirst(state: SessionState): "true" | "false" {
  if (state.agent_kind !== "owner") return "false";
  const scope = String(state.scope || "").trim().toLowerCase();
  if (!scope || scope === "company") return "false";
  if (sessionServiceTitle(state) === COMPANY_SCOPE_TITLE) return "false";
  const stored = state.calls.some((call) => call.answers.length > 0);
  return stored ? "false" : "true";
}

/** Stored claim.source stays `dossier`. Owners hear this instead. */
export function spokenSource(source: string): string {
  const raw = String(source || "").trim();
  if (/^dossier$/i.test(raw) || /business\s+dossier/i.test(raw)) return "company documentation";
  return raw;
}

export function spokenPrompt(prompt: string): string {
  return String(prompt || "")
    .replace(/\bDossier materials say\b/g, "Company documentation says")
    .replace(/\bdossier materials say\b/g, "company documentation says")
    .replace(/\b[Dd]ossier materials\b/g, "company documentation")
    .replace(/\bthe dossier\b/gi, "the company documentation")
    .replace(/\ba dossier\b/gi, "company documentation")
    .replace(/\bdossier\b/gi, "company documentation");
}

export type Question = {
  id: string;
  type?: string;
  prompt?: string;
  answer_shape?: string;
  followup?: string;
  publish_link?: string;
  claim?: { text?: string };
};

export type AnswerRow = {
  question_id: string;
  status: string;
  owner_slice: string;
  owner_words: string;
  agent_relayed?: string;
  publish_decision?: string;
  publish_source?: string;
  facts: { text: string }[];
  verify?: string;
  answered_by?: string;
  role?: string;
};

export type CallRow = {
  call_id: string;
  started_at: string;
  provisional_started_at?: string;
  ended?: boolean;
  ended_at?: string;
  pulled?: boolean;
  activity?: boolean;
  started_webhook?: boolean;
  analyzed?: boolean;
  delete_attempts?: number;
  answers: AnswerRow[];
  consent_turn?: string;
  story_count?: number;
};

export type Tap = { value: PublishValue; ts: number; call_id: string };

export type SessionState = {
  initialized: boolean;
  session_id: string;
  agent_kind: "owner" | "expert" | "voice";
  access_log: { event: string; ts: string; ip?: string; ua?: string }[];
  release: { name: string; ts: string } | null;
  series_id: string;
  cycle_no: number;
  speaker: string;
  agency_slug: string;
  topics: string[];
  status: string;
  campaign: string;
  scope: string;
  record_id: string;
  pack_file: string;
  pack_hash: string;
  question_ids: string[];
  questions: Question[];
  seeded_ids: string[];
  remaining_question_ids: string[];
  answered_by: string | null;
  role: string | null;
  agency_name: string;
  company_name: string;
  owner_name: string;
  service_title?: string;
  expires_at: number;
  created_at: number;
  start_count: number;
  start_cap: number;
  retention_days: number;
  notice_version: string;
  current_question_id: string | null;
  served: string[];
  skipped_dependent: string[];
  taps: Record<string, Tap>;
  window_publish_id: string | null;
  window_parent_id: string | null;
  window_closed: boolean;
  consent: {
    granted: boolean;
    turn: string;
    notice_version: string;
    started_at: string;
    call_id: string;
  } | null;
  consent_failures: number;
  page_token: string | null;
  page_token_call_id: string | null;
  calls: CallRow[];
  current_call_id: string | null;
  slice_from: number;
  last_activity: number;
  stale_due: number | null;
  delete_due: number | null;
  purge_due: number;
  delete_queue: string[];
};

export function applyDisplayNames(state: SessionState, payload: Record<string, unknown> = {}): SessionState {
  if (payload.agency_name) state.agency_name = displayLabel(String(payload.agency_name));
  const company = payload.company_name || payload.campaign;
  if (company) state.company_name = displayLabel(String(company));
  if (payload.owner_name || payload.answered_by) {
    state.owner_name = String(payload.owner_name || payload.answered_by);
  }
  if (payload.service_title || payload.scope) {
    state.service_title = serviceTitle(
      String(payload.scope || state.scope || ""),
      payload.service_title ? String(payload.service_title) : state.service_title,
    );
  }
  return state;
}

export function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function questionMap(state: SessionState): Map<string, Question> {
  return new Map(state.questions.map((q) => [q.id, q]));
}

function parentOfPublish(state: SessionState, publishId: string): Question | undefined {
  return state.questions.find((q) => q.publish_link === publishId);
}

function publishIdFor(question: Question | undefined): string | null {
  if (!question) return null;
  if (question.type === "publish") return question.id;
  return question.publish_link || null;
}

function currentCall(state: SessionState): CallRow | undefined {
  return state.calls.find((c) => c.call_id === state.current_call_id);
}

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

function turnsOf(payload: Record<string, unknown>): TranscriptTurn[] {
  const call = (payload.call || {}) as Record<string, unknown>;
  const raw =
    (payload.transcript_object as TranscriptTurn[]) ||
    (call.transcript_object as TranscriptTurn[]) ||
    (payload.transcript as TranscriptTurn[]) ||
    (call.transcript as TranscriptTurn[]) ||
    [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) return [{ role: "user", content: raw }];
  return [];
}

function toolArgs(payload: Record<string, unknown>): Record<string, unknown> {
  const raw = payload.arguments ?? payload.args ?? payload;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return (raw || {}) as Record<string, unknown>;
}

function toolName(payload: Record<string, unknown>): string {
  return String(payload.name || payload.tool || payload.function || payload.tool_name || "");
}

function callIdOf(payload: Record<string, unknown>): string {
  const call = (payload.call || {}) as Record<string, unknown>;
  return String(payload.call_id || call.call_id || "");
}

export function nextAlarm(state: SessionState, now: number): number | null {
  if (state.status === "purged") return null;
  const times = [state.expires_at, state.purge_due];
  if (state.stale_due != null) times.push(state.stale_due);
  if (state.delete_due != null) times.push(state.delete_due);
  const future = times.filter((t) => t > now);
  if (!future.length) return Math.min(...times);
  return Math.min(...future);
}

function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function initSession(
  payload: Record<string, unknown>,
  env: { LINK_EXPIRY_DAYS?: string; RETENTION_DAYS?: string; START_CAP?: string; VOICE_LINK_EXPIRY_DAYS?: string },
  now = Date.now(),
): SessionState {
  const questionIds = ((payload.question_ids as string[]) || []).map(String);
  const incoming = Array.isArray(payload.questions) ? (payload.questions as Question[]) : [];
  const questions =
    incoming.length > 0
      ? incoming.map((q) => ({ ...q, id: String(q.id) }))
      : questionIds.map((id) => ({ id, type: "describe", prompt: id }));
  const ids = questions.map((q) => q.id);
  const remaining = ((payload.remaining_question_ids as string[]) || ids).map(String);
  const seeded = ids.filter((id) => !remaining.includes(id));
  const kind =
    payload.agent_kind === "voice" ? "voice" : payload.agent_kind === "expert" ? "expert" : "owner";
  const voice = kind === "voice";
  const days = Number(voice ? env.VOICE_LINK_EXPIRY_DAYS || VOICE_LINK_DAYS : env.LINK_EXPIRY_DAYS || 7);
  const expires = payload.expires ? Date.parse(String(payload.expires)) : now + days * 86400000;
  const retention = Number(env.RETENTION_DAYS || 30);
  const campaign = String(payload.campaign || "");
  return {
    initialized: true,
    session_id: String(payload.session_id || ""),
    agent_kind: kind,
    series_id: String(payload.series_id || ""),
    cycle_no: Number(payload.cycle_no || 0),
    speaker: String(payload.speaker || payload.owner_name || payload.answered_by || ""),
    agency_slug: String(
      payload.agency_slug || payload.agency || slugify(String(payload.agency_name || "")),
    ),
    topics: Array.isArray(payload.topics) ? (payload.topics as unknown[]).map(String) : [],
    status: "created",
    campaign,
    scope: String(payload.scope || ""),
    record_id: String(payload.record_id || ""),
    pack_file: voice ? "" : String(payload.pack_file || ""),
    pack_hash: voice ? "" : String(payload.pack_hash || ""),
    question_ids: voice ? [] : ids,
    questions: voice ? [] : questions,
    seeded_ids: voice ? [] : seeded,
    remaining_question_ids: voice ? [] : remaining,
    answered_by: payload.answered_by ? String(payload.answered_by) : null,
    role: payload.role ? String(payload.role) : null,
    agency_name: displayLabel(String(payload.agency_name || payload.agency || "the agency")),
    company_name: displayLabel(String(payload.company_name || campaign || "the company")),
    owner_name: String(payload.owner_name || payload.speaker || payload.answered_by || "the owner"),
    service_title: serviceTitle(String(payload.scope || ""), payload.service_title ? String(payload.service_title) : ""),
    expires_at: Number.isFinite(expires) ? expires : now + days * 86400000,
    created_at: now,
    start_count: 0,
    start_cap: Number(payload.start_cap || env.START_CAP || 5),
    retention_days: retention,
    notice_version: voice ? String(payload.notice_version || VOICE_NOTICE_VERSION) : NOTICE_VERSION,
    access_log: [],
    release: null,
    current_question_id: null,
    served: [],
    skipped_dependent: [],
    taps: {},
    window_publish_id: null,
    window_parent_id: null,
    window_closed: false,
    consent: null,
    consent_failures: 0,
    page_token: null,
    page_token_call_id: null,
    calls: [],
    current_call_id: null,
    slice_from: 0,
    last_activity: now,
    stale_due: null,
    delete_due: null,
    purge_due: (Number.isFinite(expires) ? expires : now) + retention * 86400000,
    delete_queue: [],
  };
}

export function markOpened(state: SessionState): SessionState {
  if (state.status === "created") state.status = "opened";
  return state;
}

export function expireIfNeeded(state: SessionState, now: number): SessionState {
  if (now >= state.expires_at && !FINISHED.has(state.status) && state.status !== "in_progress" && state.status !== "consent_pending") {
    if (RESUMABLE.has(state.status) && state.status !== "in_progress") state.status = "expired";
  }
  if (state.status !== "purged" && now >= state.expires_at && ["created", "opened", "connecting", "dropped", "ended_early"].includes(state.status)) {
    state.status = "expired";
  }
  return state;
}

export function canStart(
  state: SessionState,
  now: number,
): { ok: true; fresh: boolean } | { ok: false; error: string; http: number } {
  expireIfNeeded(state, now);
  if (state.status === "expired") return { ok: false, error: "expired", http: 410 };
  if (state.status === "purged") return { ok: false, error: "purged", http: 404 };
  if (FINISHED.has(state.status) && state.status !== "expired") return { ok: false, error: "finished", http: 409 };
  const call = currentCall(state);
  if (state.status === "in_progress" && call && !call.ended) return { ok: false, error: "call_active", http: 409 };
  if (state.status === "consent_pending" && call && !call.ended) return { ok: false, error: "call_active", http: 409 };
  const freshConnecting = state.status === "connecting" && (!call || !call.activity);
  if (state.start_count >= state.start_cap && !freshConnecting) return { ok: false, error: "start_cap", http: 409 };
  if (freshConnecting && state.start_count >= state.start_cap) return { ok: false, error: "start_cap", http: 409 };
  if (state.agent_kind === "voice" && !state.release) return { ok: false, error: "release_required", http: 409 };
  return { ok: true, fresh: Boolean(freshConnecting) };
}

export function logAccess(
  state: SessionState,
  event: string,
  now: number,
  extra: { ip?: string; ua?: string } = {},
): SessionState {
  if (!state.access_log) state.access_log = [];
  state.access_log.push({ event, ts: iso(now), ip: extra.ip, ua: extra.ua });
  return state;
}

export function recordRelease(
  state: SessionState,
  name: string,
  now: number,
  extra: { ip?: string; ua?: string } = {},
): { ok: true } | { ok: false; error: string; http: number } {
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok: false, error: "release_name_required", http: 400 };
  state.release = { name: trimmed, ts: iso(now) };
  logAccess(state, "release", now, extra);
  return { ok: true };
}

export function expireSession(state: SessionState, now = Date.now()): SessionState {
  if (state.status !== "purged" && !FINISHED.has(state.status)) {
    state.status = "expired";
    state.last_activity = now;
  }
  return state;
}

export function issueStart(state: SessionState, now: number): { page_token: string; vars: Record<string, string> } {
  const token = randomHex(24);
  state.status = "connecting";
  state.start_count += 1;
  state.page_token = token;
  state.page_token_call_id = null;
  state.current_call_id = null;
  state.last_activity = now;
  state.stale_due = now + STALE_MS;
  return {
    page_token: token,
    vars: {
      session_id: state.session_id,
      company_name: state.company_name,
      owner_name: state.owner_name,
      agency_name: state.agency_name,
      service_title: state.agent_kind === "expert" ? "" : sessionServiceTitle(state),
      company_details_first: companyDetailsFirst(state),
      question_count: String(state.remaining_question_ids.length),
      recap: "",
      topics: "",
      session_number: state.agent_kind === "expert" ? String(state.cycle_no || 1) : "",
      last_session_date: "",
    },
  };
}

export function bindCall(state: SessionState, callId: string, now: number): SessionState {
  let call = state.calls.find((c) => c.call_id === callId);
  if (!call) {
    call = {
      call_id: callId,
      started_at: iso(now),
      provisional_started_at: iso(now),
      answers: [],
      activity: false,
    };
    state.calls.push(call);
  }
  if (state.current_call_id !== callId) state.slice_from = 0;
  state.current_call_id = callId;
  state.page_token_call_id = callId;
  state.last_activity = now;
  state.stale_due = now + STALE_MS;
  return state;
}

export function pageTokenOk(state: SessionState, header: string | null): boolean {
  if (!state.page_token || !header) return false;
  return timingSafeEqualString(state.page_token, header);
}

function openWindowFor(state: SessionState, question: Question): void {
  const pub = publishIdFor(question);
  if (question.type !== "publish" && question.publish_link) {
    state.window_publish_id = question.publish_link;
    state.window_parent_id = question.id;
    state.window_closed = false;
  }
  if (pub && state.window_publish_id === pub) state.window_closed = false;
}

function closeWindowIfPast(state: SessionState, question: Question): void {
  if (!state.window_publish_id || state.window_closed) return;
  const pubIndex = state.question_ids.indexOf(state.window_publish_id);
  const qIndex = state.question_ids.indexOf(question.id);
  if (pubIndex >= 0 && qIndex > pubIndex) {
    state.window_closed = true;
    state.window_publish_id = null;
    state.window_parent_id = null;
  }
}

function windowOpen(state: SessionState, publishId: string): boolean {
  return !state.window_closed && state.window_publish_id === publishId;
}

export function applyTap(
  state: SessionState,
  questionId: string,
  value: string,
  now: number,
): { ok: true; value: PublishValue } | { ok: false; error: "tap_rejected" } {
  if (!PUBLISH_ENUM.includes(value as PublishValue)) return { ok: false, error: "tap_rejected" };
  const q = questionMap(state).get(questionId);
  const publishId = q?.type === "publish" ? q.id : q?.publish_link || (state.window_publish_id === questionId ? questionId : null);
  const resolved =
    publishId ||
    (state.window_parent_id === questionId ? state.window_publish_id : null) ||
    (state.questions.some((item) => item.id === questionId && item.type === "publish") ? questionId : null);
  if (!resolved || !windowOpen(state, resolved)) return { ok: false, error: "tap_rejected" };
  const call = currentCall(state);
  if (!call || call.ended) return { ok: false, error: "tap_rejected" };
  state.taps[resolved] = { value: value as PublishValue, ts: now, call_id: call.call_id };
  return { ok: true, value: value as PublishValue };
}

export function questionCard(state: SessionState): Record<string, unknown> {
  expireIfNeeded(state, Date.now());
  const finished = FINISHED.has(state.status) || !RESUMABLE.has(state.status);
  const hideCard = state.status === "connecting" || state.status === "consent_pending" || state.status === "created" || state.status === "opened";
  const current = state.current_question_id ? questionMap(state).get(state.current_question_id) : undefined;
  const tapFor = current ? publishIdFor(current) || state.window_publish_id : state.window_publish_id;
  const tapOpen = Boolean(
    !hideCard &&
      tapFor &&
      windowOpen(state, tapFor) &&
      current &&
      (current.id === state.window_parent_id || current.id === state.window_publish_id || current.publish_link === state.window_publish_id),
  );
  return {
    session_id: state.session_id,
    status: state.status,
    finished,
    current: hideCard || !current
      ? null
      : {
          id: current.id,
          type: current.type,
          prompt: spokenPrompt(current.prompt),
        },
    tap_open: tapOpen,
    tap_question_id: tapOpen ? state.window_parent_id || tapFor : null,
    window_publish_id: tapOpen ? tapFor : null,
    question_count: state.question_ids.length,
    remaining_count: state.remaining_question_ids.length,
    current_index: current ? state.question_ids.indexOf(current.id) + 1 : null,
  };
}

function answerFor(state: SessionState, questionId: string): AnswerRow | undefined {
  for (let i = state.calls.length - 1; i >= 0; i--) {
    const row = state.calls[i].answers.find((a) => a.question_id === questionId);
    if (row) return row;
  }
  return undefined;
}

function nextUnserved(state: SessionState): Question | null {
  const map = questionMap(state);
  for (const id of state.question_ids) {
    if (state.seeded_ids.includes(id)) continue;
    if (state.skipped_dependent.includes(id)) continue;
    if (state.served.includes(id)) continue;
    const answered = state.calls.some((c) => c.answers.some((a) => a.question_id === id && a.status === "answered"));
    if (answered) continue;
    return map.get(id) || null;
  }
  return null;
}

function maybeSkipDependent(state: SessionState, servedParent: Question): void {
  if (!servedParent.publish_link) return;
  const row = answerFor(state, servedParent.id);
  if (row && row.status !== "answered") {
    if (!state.skipped_dependent.includes(servedParent.publish_link)) {
      state.skipped_dependent.push(servedParent.publish_link);
    }
  }
}

function publicQuestion(q: Question, state: SessionState): Record<string, unknown> {
  const pub = q.publish_link;
  const tapped = pub && state.taps[pub] ? state.taps[pub].value : q.type === "publish" && state.taps[q.id] ? state.taps[q.id].value : null;
  return {
    id: q.id,
    type: q.type || "describe",
    prompt: spokenPrompt(q.prompt || ""),
    answer_shape: q.answer_shape || "free text",
    followup: q.followup || "",
    has_publish_link: Boolean(q.publish_link),
    publish_tapped: tapped,
  };
}

export function handleTool(
  state: SessionState,
  payload: Record<string, unknown>,
  now = Date.now(),
): Record<string, unknown> {
  const name = toolName(payload);
  const args = toolArgs(payload);
  const cid = callIdOf(payload) || state.current_call_id || "";
  const turns = turnsOf(payload);
  if (state.status === "connecting") state.status = "consent_pending";
  let call = state.calls.find((c) => c.call_id === cid);
  if (!call && cid) {
    bindCall(state, cid, now);
    call = currentCall(state);
  }
  if (call) {
    call.activity = true;
    state.last_activity = now;
    state.stale_due = now + STALE_MS;
  }

  if (name === "report_consent") return reportConsent(state, args, turns, now);
  if (name === "get_next_question") return getNextQuestion(state, turns, now);
  if (name === "report_answer") return reportAnswer(state, args, turns, now);
  if (name === "report_story") return prepareStory(state, args, turns, now);
  if (name === "end_interview") return endInterview(state, args, now);
  return { ok: false, error: "unknown_tool" };
}

function reportConsent(
  state: SessionState,
  args: Record<string, unknown>,
  turns: TranscriptTurn[],
  now: number,
): Record<string, unknown> {
  const call = currentCall(state);
  const granted = args.granted === true || args.granted === "true";
  if (args.granted === false || args.granted === "false") {
    state.status = "consent_refused";
    if (call) state.delete_queue.push(call.call_id);
    state.delete_due = now + DELETE_BACKOFF_MS[0];
    return { ok: true, status: "consent_refused" };
  }
  if (!granted) return { ok: false, error: "consent_unverified" };
  const turn = latestOwnerTurn(turns);
  if (!hasAffirmative(turn)) {
    state.consent_failures += 1;
    if (state.consent_failures >= 2) {
      state.status = "consent_refused";
      if (call) {
        state.delete_queue.push(call.call_id);
        state.delete_due = now + DELETE_BACKOFF_MS[0];
      }
      return { ok: true, status: "consent_refused" };
    }
    return { ok: false, error: "consent_unverified" };
  }
  state.status = "in_progress";
  state.consent = {
    granted: true,
    turn,
    notice_version: state.notice_version,
    started_at: call?.started_at || iso(now),
    call_id: call?.call_id || "",
  };
  if (call) call.consent_turn = turn;
  return attachNext(state, turns, now, { ok: true, status: "in_progress" });
}

function attachNext(
  state: SessionState,
  turns: TranscriptTurn[],
  now: number,
  base: Record<string, unknown>,
): Record<string, unknown> {
  if (state.agent_kind === "expert" || state.agent_kind === "voice") return base;
  if (state.status !== "in_progress") return base;
  const next = getNextQuestion(state, turns, now);
  if (next.error) return base;
  if (next.done) return { ...base, done: true };
  return { ...base, question: next.question };
}

function getNextQuestion(state: SessionState, turns: TranscriptTurn[], now: number): Record<string, unknown> {
  if (state.status !== "in_progress") return { ok: false, error: "consent_required" };
  if (state.current_question_id) {
    const prev = questionMap(state).get(state.current_question_id);
    const reported = answerFor(state, state.current_question_id);
    if (prev && !reported) {
      if (turns.length > 0) state.slice_from = turns.length;
      state.last_activity = now;
      return { ok: true, question: publicQuestion(prev, state), repeated: true };
    }
    if (prev) maybeSkipDependent(state, prev);
  }
  const next = nextUnserved(state);
  if (!next) return { ok: true, done: true };
  closeWindowIfPast(state, next);
  openWindowFor(state, next);
  if (!state.served.includes(next.id)) state.served.push(next.id);
  state.current_question_id = next.id;
  state.slice_from = turns.length;
  state.last_activity = now;
  return { ok: true, question: publicQuestion(next, state) };
}

function mergePublish(
  state: SessionState,
  question: Question,
  spoken: string | undefined,
): { publish_decision?: string; publish_source: string } {
  const pubId = question.type === "publish" ? question.id : question.publish_link;
  const tap = pubId ? state.taps[pubId] : undefined;
  const late = pubId && tap && !windowOpen(state, pubId) && state.window_closed;
  if (tap && (windowOpen(state, pubId || "") || late)) {
    return { publish_decision: tap.value, publish_source: late ? "tap_late" : "tap" };
  }
  if (spoken && PUBLISH_ENUM.includes(spoken as PublishValue)) {
    return { publish_decision: spoken, publish_source: "spoken" };
  }
  return { publish_source: "missing" };
}

function isAgentTurn(turn: TranscriptTurn): boolean {
  const role = String(turn.role || "").toLowerCase();
  return role === "agent" || role === "assistant";
}

function questionSpoken(turns: TranscriptTurn[], fromIndex: number): boolean {
  if (!turns.some(isAgentTurn)) return true;
  const start = fromIndex >= turns.length ? 0 : Math.max(0, fromIndex);
  return turns.slice(start).some(isAgentTurn);
}

const SHORT_FINISHED = new Set([
  "yes",
  "no",
  "yeah",
  "yep",
  "sure",
  "ok",
  "okay",
  "true",
  "false",
  "public",
  "internal",
  "framing-only",
]);

function ownerStillGoing(turns: TranscriptTurn[]): boolean {
  if (!turns.some(isAgentTurn)) return false;
  const last = latestOwnerTurn(turns);
  if (!last) return false;
  if (/[.?!]["']?$/.test(last)) return false;
  const key = last.toLowerCase().replace(/[.?!,"']/g, "").trim();
  if (SHORT_FINISHED.has(key)) return false;
  const words = last.split(/\s+/).filter(Boolean);
  return words.length <= 2;
}

function reportAnswer(
  state: SessionState,
  args: Record<string, unknown>,
  turns: TranscriptTurn[],
  now: number,
): Record<string, unknown> {
  if (state.status !== "in_progress") return { ok: false, error: "consent_required" };
  const questionId = String(args.question_id || args.id || "");
  const question = questionMap(state).get(questionId);
  if (!question) return { ok: false, error: "unknown_question" };
  const call = currentCall(state);
  if (!call) return { ok: false, error: "no_call" };
  const prior = call.answers.find((a) => a.question_id === questionId);
  if (prior) {
    return attachNext(state, turns, now, {
      ok: true,
      already_reported: true,
      recorded_publish: prior.publish_decision,
      publish_source: prior.publish_source,
    });
  }
  if (state.current_question_id && questionId !== state.current_question_id) {
    return { ok: false, error: "wrong_question", question_id: state.current_question_id };
  }
  if (!questionSpoken(turns, state.slice_from)) {
    return { ok: false, error: "question_not_spoken", question: publicQuestion(question, state) };
  }
  const answerStatus = String(args.status || "answered");
  if (answerStatus === "answered" && ownerStillGoing(turns)) {
    return { ok: false, error: "owner_not_finished", question_id: questionId };
  }
  const slice = ownerSlice(turns, state.slice_from);
  const relayed = String(args.owner_words || args.words || "");
  const factsRaw = Array.isArray(args.facts) ? args.facts : [];
  const facts = factsRaw.map((fact) => (typeof fact === "string" ? { text: fact } : { text: String((fact as { text?: string }).text || "") }));
  const spoken = args.publish_decision ? String(args.publish_decision) : undefined;
  const merged = mergePublish(state, question, spoken);
  let verify: string | undefined;
  let verifyIgnored = false;
  if (args.verify != null && args.verify !== "") {
    if (question.type === "verify") verify = String(args.verify);
    else verifyIgnored = true;
  }
  const row: AnswerRow = {
    question_id: questionId,
    status: answerStatus,
    owner_slice: slice,
    owner_words: slice,
    agent_relayed: relayed || undefined,
    publish_decision: merged.publish_decision,
    publish_source: merged.publish_source,
    facts,
    verify,
    answered_by: state.answered_by || undefined,
    role: state.role || undefined,
  };
  call.answers.push(row);
  state.remaining_question_ids = state.remaining_question_ids.filter((id) => id !== questionId);
  state.last_activity = now;
  return attachNext(state, turns, now, {
    ok: true,
    recorded_publish: row.publish_decision,
    publish_source: row.publish_source,
    verify_ignored: verifyIgnored || undefined,
  });
}

export function prepareStory(
  state: SessionState,
  args: Record<string, unknown>,
  turns: TranscriptTurn[],
  now: number,
): Record<string, unknown> {
  if (state.status !== "in_progress") return { ok: false, error: "consent_required" };
  const call = currentCall(state);
  if (!call) return { ok: false, error: "no_call" };
  const storyKey = String(args.story_key || "").trim();
  const headline = String(args.headline || "").trim();
  const words = String(args.words || "").trim();
  if (!storyKey) return { ok: false, error: "missing_field", field: "story_key" };
  if (!headline) return { ok: false, error: "missing_field", field: "headline" };
  if (headline.length > 120) return { ok: false, error: "headline_too_long" };
  if (!words) return { ok: false, error: "missing_field", field: "words" };
  const flags = (Array.isArray(args.flags) ? args.flags.map(String) : []).filter((flag) =>
    (STORY_FLAGS as readonly string[]).includes(flag),
  );
  const publish = String(args.publish_decision || "public");
  const decision = PUBLISH_ENUM.includes(publish as (typeof PUBLISH_ENUM)[number]) ? publish : "public";
  const slice = ownerSlice(turns, state.slice_from);
  const count = (call.story_count || 0) + 1;
  return {
    ok: true,
    pending_ledger: true,
    story: {
      call_id: call.call_id,
      story_key: storyKey,
      theme: args.theme ? String(args.theme) : undefined,
      headline,
      words,
      owner_slice: slice,
      publish_decision: decision,
      flags,
      pd_candidate: Boolean(args.pd_candidate) || flags.includes("pd_candidate"),
      speaker: String(args.speaker || state.speaker || state.owner_name),
      cycle_no: state.cycle_no || undefined,
      date: iso(now),
    },
    next_count: count,
  };
}

export function recordStoryCount(state: SessionState, callId: string, count: number): void {
  const call = state.calls.find((c) => c.call_id === callId);
  if (call) call.story_count = count;
}

export function expertStartVars(
  state: SessionState,
  ctx: {
    recap?: string;
    topics?: string[];
    last_session_date?: string;
    cadence?: { freq?: string; interval?: number } | null;
  } = {},
): Record<string, string> {
  const cap = timeCapForCadence(ctx.cadence);
  return {
    recap: String(ctx.recap || ""),
    topics: (ctx.topics || state.topics || []).slice(0, 12).join(", "),
    session_number: String(state.cycle_no || 1),
    last_session_date: String(ctx.last_session_date || ""),
    time_cap: cap.label,
    time_cap_max: cap.max_label,
  };
}

function endInterview(state: SessionState, args: Record<string, unknown>, now: number): Record<string, unknown> {
  const reason = String(args.reason || args.status || "complete");
  const kind = state.agent_kind || "owner";
  const questionsLeft = state.remaining_question_ids.length > 0;
  if (reason === "consent_withdrawn") state.status = "consent_withdrawn";
  else if (reason === "tool_error" || reason === "paused") state.status = "ended_early";
  else if (questionsLeft && kind !== "expert" && kind !== "voice") state.status = "ended_early";
  else state.status = "completed";
  state.last_activity = now;
  const call = currentCall(state);
  if (call) {
    call.ended = true;
    call.ended_at = iso(now);
  }
  state.page_token = null;
  return {
    ok: true,
    status: state.status,
    resumable: RESUMABLE.has(state.status),
    remaining_count: state.remaining_question_ids.length,
  };
}

export function handleWebhook(
  state: SessionState,
  payload: Record<string, unknown>,
  now = Date.now(),
): { ok: true; noop?: boolean } {
  const event = String(payload.event || payload.name || "");
  const call = (payload.call || payload) as Record<string, unknown>;
  const cid = String(call.call_id || payload.call_id || "");
  if (!cid) return { ok: true, noop: true };
  let row = state.calls.find((c) => c.call_id === cid);
  if (!row) {
    if (state.current_call_id === cid || state.status === "connecting" || state.status === "consent_pending") {
      bindCall(state, cid, now);
      row = currentCall(state);
    } else {
      return { ok: true, noop: true };
    }
  }
  if (event === "call_started") {
    if (row && !row.started_webhook) {
      const start = String(call.start_timestamp || call.start_time || row.started_at);
      row.started_at = typeof start === "string" && start ? (Number(start) ? iso(Number(start)) : start) : row.started_at;
      row.started_webhook = true;
    }
    if (state.status === "connecting") state.status = "consent_pending";
    state.last_activity = now;
    state.stale_due = now + STALE_MS;
    return { ok: true };
  }
  if (event === "call_ended") {
    if (row?.ended) return { ok: true };
    const previousCallDuringFreshStart =
      Boolean(row) && state.status === "connecting" && !state.current_call_id;
    if (state.current_call_id && cid && state.current_call_id !== cid) {
      if (row) {
        row.ended = true;
        row.ended_at = iso(now);
      }
      return { ok: true };
    }
    if (previousCallDuringFreshStart) {
      if (row) {
        row.ended = true;
        row.ended_at = iso(now);
      }
      return { ok: true };
    }
    if (row) {
      row.ended = true;
      row.ended_at = iso(now);
    }
    state.page_token = null;
    if (state.status === "consent_pending") state.status = "dropped";
    else if (state.status === "connecting") state.status = "dropped";
    else if (state.status === "in_progress") state.status = "dropped";
    else if (state.status === "consent_refused") {
      if (row && !state.delete_queue.includes(row.call_id)) state.delete_queue.push(row.call_id);
      state.delete_due = now + DELETE_BACKOFF_MS[0];
    }
    state.stale_due = null;
    return { ok: true };
  }
  if (event === "call_analyzed") {
    if (row) row.analyzed = true;
    state.last_activity = now;
    return { ok: true };
  }
  return { ok: true, noop: true };
}

export function openCallId(state: SessionState): string | null {
  const call = currentCall(state);
  if (!call || call.ended || !call.call_id) return null;
  if (!["in_progress", "consent_pending", "connecting"].includes(state.status)) return null;
  return call.call_id;
}

export function dropIfVendorEnded(state: SessionState, remoteStatus: string, now: number): boolean {
  const remote = String(remoteStatus || "");
  if (remote !== "ended" && remote !== "error") return false;
  if (!openCallId(state)) return false;
  applyStaleEnd(state, now);
  return true;
}

export function applyStaleEnd(state: SessionState, now: number): SessionState {
  const call = currentCall(state);
  if (!call || call.ended) {
    state.stale_due = null;
    return state;
  }
  handleWebhook(state, { event: "call_ended", call: { call_id: call.call_id } }, now);
  return state;
}

export function ackCalls(
  state: SessionState,
  callIds: string[],
  acceptWithdrawn = false,
): { delete_ids: string[] } {
  const deleteIds: string[] = [];
  for (const id of callIds) {
    const row = state.calls.find((c) => c.call_id === id);
    if (row) row.pulled = true;
  }
  if (state.status === "consent_withdrawn" && !acceptWithdrawn) {
    for (const id of callIds) deleteIds.push(id);
  }
  if (state.status === "consent_withdrawn" && acceptWithdrawn) {
    for (const id of callIds) deleteIds.push(id);
  }
  if (state.status === "consent_refused") {
    for (const id of callIds) deleteIds.push(id);
  }
  for (const id of deleteIds) {
    if (!state.delete_queue.includes(id)) state.delete_queue.push(id);
  }
  if (deleteIds.length && state.delete_due == null) state.delete_due = Date.now() + DELETE_BACKOFF_MS[0];
  return { delete_ids: deleteIds };
}

export function canPurge(state: SessionState, now: number): boolean {
  if (now < state.purge_due) return false;
  const unacked = state.calls.some((c) => c.call_id && !c.pulled);
  return !unacked;
}

export function purge(state: SessionState): SessionState {
  state.status = "purged";
  state.questions = [];
  state.calls = [];
  state.taps = {};
  state.consent = null;
  state.page_token = null;
  state.agency_name = "";
  state.company_name = "";
  state.owner_name = "";
  state.service_title = "";
  state.answered_by = null;
  state.release = null;
  state.access_log = [];
  return state;
}

export function exportSession(state: SessionState): Record<string, unknown> {
  return {
    session_id: state.session_id,
    agent_kind: state.agent_kind || "owner",
    campaign: state.campaign,
    speaker: state.speaker,
    notice_version: state.notice_version,
    release: state.release,
    access_log: state.access_log || [],
    record_id: state.record_id,
    pack_file: state.pack_file,
    pack_hash: state.pack_hash,
    question_ids: state.question_ids,
    status: state.status,
    answered_by: state.answered_by,
    role: state.role,
    consent: state.consent,
    calls: state.calls.map((call) => ({
      call_id: call.call_id,
      started_at: call.started_at,
      pulled: Boolean(call.pulled),
      analyzed: Boolean(call.analyzed),
      answers: call.answers.map((answer) => ({
        question_id: answer.question_id,
        status: answer.status,
        owner_slice: answer.owner_slice,
        owner_words: answer.owner_words,
        agent_relayed: answer.agent_relayed,
        publish_decision: answer.publish_decision,
        publish_source: answer.publish_source,
        facts: answer.facts,
        verify: answer.verify,
      })),
    })),
  };
}

export function sessionPagePath(state: { agent_kind?: string; agency_slug?: string; session_id: string }): string {
  if (state.agent_kind === "voice" && state.agency_slug) {
    return `/v/${state.agency_slug}/${state.session_id}`;
  }
  if (state.agency_slug) {
    return `/i/${state.agency_slug}/${state.session_id}`;
  }
  return `/s/${state.session_id}`;
}

export function statusView(state: SessionState, origin: string): Record<string, unknown> {
  return {
    session_id: state.session_id,
    agent_kind: state.agent_kind || "owner",
    status: state.status,
    url: `${origin}${sessionPagePath(state)}`,
    remaining_question_ids: state.remaining_question_ids,
    resumable: RESUMABLE.has(state.status) && state.status !== "expired",
    expires_at: iso(state.expires_at),
    start_count: state.start_count,
    record_id: state.record_id,
    pack_hash: state.pack_hash,
  };
}

export { AFFIRMATIVE };
