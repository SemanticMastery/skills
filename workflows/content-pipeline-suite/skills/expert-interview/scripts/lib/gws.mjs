import { cadenceLabel } from "./series-record.mjs";

const DOW = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const SLOT_HOUR = 9;
const SLOT_MINUTE = 0;

function parseByday(raw, monthly) {
  const token = String(raw || "MO").toUpperCase();
  const match = /^(-?[1-4])?(SU|MO|TU|WE|TH|FR|SA)$/.exec(token);
  if (!match) return { nth: monthly ? 1 : 1, dow: 1 };
  return { nth: match[1] ? Number(match[1]) : 1, dow: DOW[match[2]] };
}

function zonedParts(ms, timeZone) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    dtf
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function zonedTimeToUtc(year, month, day, hour, minute, timeZone) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const asLocal = (ms) => {
    const p = zonedParts(ms, timeZone);
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, 0);
  };
  return utc - (asLocal(utc) - utc);
}

function nthWeekdayOfMonth(year, month, dow, nth) {
  if (nth < 0) {
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const lastDow = new Date(Date.UTC(year, month - 1, last)).getUTCDay();
    return last - ((lastDow - dow + 7) % 7);
  }
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  return 1 + ((dow - firstDow + 7) % 7) + (nth - 1) * 7;
}

function addMonths(year, month, count) {
  const d = new Date(Date.UTC(year, month - 1 + count, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/** Next cadence occurrence at 09:00 in the series timezone. */
export function nextOccurrenceIso(record, now = Date.now()) {
  const tz = record.timezone || "America/New_York";
  const cadence = record.cadence || {};
  const monthly = cadence.freq === "monthly";
  const { nth, dow } = parseByday(cadence.byday, monthly);

  if (monthly) {
    let { year, month } = zonedParts(now, tz);
    for (let i = 0; i < 14; i += 1) {
      const day = nthWeekdayOfMonth(year, month, dow, nth);
      const ms = zonedTimeToUtc(year, month, day, SLOT_HOUR, SLOT_MINUTE, tz);
      if (ms > now) return new Date(ms).toISOString();
      ({ year, month } = addMonths(year, month, 1));
    }
  }

  const start = zonedParts(now, tz);
  for (let i = 0; i < 400; i += 1) {
    const dt = new Date(Date.UTC(start.year, start.month - 1, start.day + i));
    if (dt.getUTCDay() !== dow) continue;
    const ms = zonedTimeToUtc(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), SLOT_HOUR, SLOT_MINUTE, tz);
    if (ms > now) return new Date(ms).toISOString();
  }
  return new Date(now).toISOString();
}

export function rruleFromCadence(cadence) {
  const byday = cadence?.byday ? `;BYDAY=${cadence.byday}` : "";
  if (cadence?.freq === "monthly") return `RRULE:FREQ=MONTHLY;INTERVAL=${cadence.interval || 1}${byday}`;
  return `RRULE:FREQ=WEEKLY;INTERVAL=${cadence?.interval || 2}${byday}`;
}

export function eventPayload(record, settings, { startIso, endIso } = {}) {
  const start = startIso || record.cadence?.anchor_iso || new Date().toISOString();
  const startMs = Date.parse(start);
  const end = endIso || new Date(startMs + 30 * 60 * 1000).toISOString();
  return {
    summary: `${record.company_name} Expert Interview Call for ${record.agency_name}`,
    description: `Join: ${record.link}\nThirty-minute recorded interview. Open the link when the event starts.`,
    start: { dateTime: start, timeZone: record.timezone },
    end: { dateTime: end, timeZone: record.timezone },
    recurrence: [rruleFromCadence(record.cadence)],
    attendees: [{ email: record.spokesperson_email }],
  };
}

export function gwsInsertArgv({ settings, event, dryRun = true }) {
  const args = [
    "calendar",
    "events",
    "insert",
    "--params",
    JSON.stringify({ calendarId: settings.calendar_id || "primary", sendUpdates: "all" }),
    "--json",
    JSON.stringify(event),
  ];
  if (dryRun) args.push("--dry-run");
  return args;
}

export function gwsInsertCommand({ settings, event, dryRun = true }) {
  return ["gws", ...gwsInsertArgv({ settings, event, dryRun })].join(" ");
}

export function gwsDeleteArgv({ settings, eventId }) {
  return [
    "calendar",
    "events",
    "delete",
    "--params",
    JSON.stringify({ calendarId: settings.calendar_id || "primary", eventId, sendUpdates: "all" }),
  ];
}

export function gwsDeleteCommand({ settings, eventId }) {
  return ["gws", ...gwsDeleteArgv({ settings, eventId })].join(" ");
}

export function gwsPatchArgv({ settings, eventId, event }) {
  return [
    "calendar",
    "events",
    "patch",
    "--params",
    JSON.stringify({ calendarId: settings.calendar_id || "primary", eventId, sendUpdates: "all" }),
    "--json",
    JSON.stringify(event),
  ];
}

export function gwsPatchCommand({ settings, eventId, event }) {
  return ["gws", ...gwsPatchArgv({ settings, eventId, event })].join(" ");
}

export function loginCommand(configDir) {
  return `gws auth login`;
}

export { cadenceLabel };
