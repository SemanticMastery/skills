/**
 * Shared argv parser for voice-interview CLIs.
 * Copied from owner-interview with allowlisted voice deltas (KTD16).
 * --campaign-dir must be absolute (enforced by paths.mjs).
 */

export const ACTION_FLAGS = {
  "--claims": "claims",
  "--draft": "draft",
  "--delta": "delta",
  "--create": "create",
  "--add-answer": "addAnswer",
  "--mark-unanswered": "markUnanswered",
  "--question-id": "questionId",
  "--set-state": "setState",
  "--set-source-id": "setSourceId",
  "--partial": "partial",
  "--write": "write",
  "--dry-run": "dryRun",
  "--slug": "slug",
  "--list-flagged": "listFlagged",
  "--review": "review",
  "--fact": "fact",
  "--clear": "clear",
  "--edit": "edit",
  "--drop": "drop",
  "--create-link": "createLink",
  "--status": "status",
  "--pull": "pull",
  "--from-file": "fromFile",
  "--accept-withdrawn": "acceptWithdrawn",
  "--accept-pack-hash": "acceptPackHash",
  "--expires": "expires",
  "--answered-by": "answeredBy",
  "--role": "role",
  "--scopes": "scopes",
  "--exclude": "exclude",
  "--no-company": "noCompany",
  "--plan": "plan",
  "--speaker": "speaker",
  "--list": "list",
  "--show": "show",
  "--prepare": "prepare",
  "--land": "land",
  "--accept-under-floor": "acceptUnderFloor",
  "--confirm-overwrite": "confirmOverwrite",
  "--speaker-verified": "speakerVerified",
  "--accept-content-flags": "acceptContentFlags",
  "--retire": "retire",
};

const TAKES_VALUE = new Set([
  "--claims",
  "--draft",
  "--add-answer",
  "--question-id",
  "--set-state",
  "--set-source-id",
  "--slug",
  "--fact",
  "--edit",
  "--from-file",
  "--expires",
  "--answered-by",
  "--role",
  "--scopes",
  "--exclude",
  "--speaker",
]);

export function parseArgs(argv = process.argv, { actions } = {}) {
  const out = { help: false, extras: [], unknown: null, foreignFlag: null };
  const allowed = Array.isArray(actions) ? new Set(actions) : null;
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") {
      out.help = true;
      continue;
    }
    if (a === "--campaign-dir") {
      out.campaignDir = argv[++i];
      continue;
    }
    if (a === "--scope") {
      out.scope = argv[++i];
      continue;
    }
    if (a.startsWith("--")) {
      const action = ACTION_FLAGS[a];
      if (action && allowed && !allowed.has(action)) {
        out.foreignFlag = a;
        if (TAKES_VALUE.has(a)) i += 1;
        continue;
      }
      if (a === "--claims") out.claims = argv[++i];
      else if (a === "--draft") out.draft = argv[++i];
      else if (a === "--delta") out.delta = true;
      else if (a === "--create") out.create = true;
      else if (a === "--add-answer") out.addAnswer = argv[++i];
      else if (a === "--mark-unanswered") out.markUnanswered = true;
      else if (a === "--question-id") out.questionId = argv[++i];
      else if (a === "--set-state") out.setState = argv[++i];
      else if (a === "--set-source-id") out.setSourceId = argv[++i];
      else if (a === "--partial") out.partial = true;
      else if (a === "--write") out.write = true;
      else if (a === "--dry-run") out.dryRun = true;
      else if (a === "--slug") out.slug = argv[++i];
      else if (a === "--list-flagged") out.listFlagged = true;
      else if (a === "--review") out.review = true;
      else if (a === "--fact") out.fact = argv[++i];
      else if (a === "--clear") out.clear = true;
      else if (a === "--edit") out.edit = argv[++i];
      else if (a === "--drop") out.drop = true;
      else if (a === "--create-link") out.createLink = true;
      else if (a === "--status") out.status = true;
      else if (a === "--pull") out.pull = true;
      else if (a === "--from-file") out.fromFile = argv[++i];
      else if (a === "--accept-withdrawn") out.acceptWithdrawn = true;
      else if (a === "--accept-pack-hash") out.acceptPackHash = true;
      else if (a === "--expires") out.expires = argv[++i];
      else if (a === "--answered-by") out.answeredBy = argv[++i];
      else if (a === "--role") out.role = argv[++i];
      else if (a === "--scopes") out.scopes = argv[++i];
      else if (a === "--exclude") out.exclude = argv[++i];
      else if (a === "--no-company") out.noCompany = true;
      else if (a === "--plan") out.plan = true;
      else if (a === "--speaker") out.speaker = argv[++i];
      else if (a === "--list") out.list = true;
      else if (a === "--show") out.show = true;
      else if (a === "--prepare") out.prepare = true;
      else if (a === "--land") out.land = true;
      else if (a === "--accept-under-floor") out.acceptUnderFloor = true;
      else if (a === "--confirm-overwrite") out.confirmOverwrite = true;
      else if (a === "--speaker-verified") out.speakerVerified = true;
      else if (a === "--accept-content-flags") out.acceptContentFlags = true;
      else if (a === "--retire") out.retire = true;
      else out.unknown = a;
    } else {
      out.extras.push(a);
    }
  }
  return out;
}

function redactExtra(extra) {
  if (!extra || typeof extra !== "object") return extra;
  const out = {};
  for (const [key, value] of Object.entries(extra)) {
    if (/authorization|token|api_key|apikey|bearer|secret/i.test(key)) {
      out[key] = "[redacted]";
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 200);
    } else {
      out[key] = value;
    }
  }
  return out;
}

export function fail(error, extra = {}) {
  console.log(JSON.stringify({ error, ...redactExtra(extra) }));
  process.exit(1);
}
