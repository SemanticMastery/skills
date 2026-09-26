import fs from "node:fs";
import path from "node:path";
import {
  collectInterviewFiles,
  companySlug,
  speakerSlug,
  voiceArchiveDir,
  voiceDnaPath,
  voiceRecordPair,
  voiceTranscriptPair,
} from "./paths.mjs";

export const RECORD_STATES = ["open", "captured", "extracted", "superseded"];
export const LEGAL_TRANSITIONS = {
  open: ["captured"],
  captured: ["extracted", "superseded"],
  extracted: ["superseded"],
  superseded: [],
};

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function isRecord(data) {
  if (!data || typeof data !== "object") return false;
  return data.kind === "voice-interview" || Boolean(data.speaker && data.state);
}

export function listVoiceEntries(campaignDir, speaker) {
  const slug = speakerSlug(speaker);
  const prefix = `${companySlug(campaignDir)}-voice-interview-${slug}-`;
  return collectInterviewFiles(
    campaignDir,
    "voice",
    (name) =>
      name.startsWith(prefix) &&
      name.endsWith(".json") &&
      !name.includes("-voice-interview-transcript-"),
  )
    .map((file) => {
      let data = null;
      try {
        data = JSON.parse(fs.readFileSync(file.path, "utf8"));
      } catch {
        data = null;
      }
      return {
        name: file.name,
        json: file.path,
        md: file.path.replace(/\.json$/i, ".md"),
        data,
      };
    })
    .filter((entry) => entry.data && isRecord(entry.data));
}

export function findActiveRecordEntry(campaignDir, speaker) {
  const entries = listVoiceEntries(campaignDir, speaker);
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i].data.state !== "superseded") return entries[i];
  }
  return null;
}

export function atomicWrite(filePath, contents, io = {}) {
  const rename = io.rename || fs.renameSync;
  const unlink = io.unlink || fs.unlinkSync;
  const writeFile = io.writeFile || fs.writeFileSync;
  const tmpPath = `${filePath}.tmp`;
  writeFile(tmpPath, contents);
  const tryRename = (from, to) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        rename(from, to);
        return null;
      } catch (err) {
        if (err?.code !== "EBUSY" && err?.code !== "EPERM" && err?.code !== "EEXIST") {
          try {
            unlink(tmpPath);
          } catch {
            /* ignore */
          }
          throw err;
        }
        if (attempt < 2) sleepMs(25 * (attempt + 1));
      }
    }
    return { error: "write_locked", extra: { path: to } };
  };

  let renamed = tryRename(tmpPath, filePath);
  if (!renamed) return null;
  if (fs.existsSync(filePath)) {
    const bakPath = `${filePath}.bak`;
    const movedAside = tryRename(filePath, bakPath);
    if (movedAside) {
      try {
        unlink(tmpPath);
      } catch {
        /* ignore */
      }
      return movedAside;
    }
    const placed = tryRename(tmpPath, filePath);
    if (placed) {
      try {
        rename(bakPath, filePath);
      } catch {
        /* ignore */
      }
      try {
        unlink(tmpPath);
      } catch {
        /* ignore */
      }
      return placed;
    }
    try {
      unlink(bakPath);
    } catch {
      /* ignore */
    }
    return null;
  }
  try {
    unlink(tmpPath);
  } catch {
    /* ignore */
  }
  return renamed;
}

export function renderRecordMarkdown(record) {
  const speaker = record.speaker || "";
  const lines = [
    `# Voice interview — ${speaker}`,
    "",
    `- Campaign: ${record.campaign || ""}`,
    `- Speaker: ${speaker}`,
    `- State: ${record.state}`,
    `- Opened: ${record.opened || ""}`,
    `- Host session: ${record.host_session_id || "—"}`,
    `- Word count: ${record.word_count == null ? "—" : record.word_count}`,
    `- Under floor: ${record.under_floor ? "yes" : "no"}`,
    `- Voice DNA: ${record.voice_dna_path || "—"}`,
    "",
  ];
  return lines.join("\n");
}

export function writePair(jsonPath, mdPath, record, io) {
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  const jsonError = atomicWrite(jsonPath, `${JSON.stringify(record, null, 2)}\n`, io);
  if (jsonError) return jsonError;
  const mdError = atomicWrite(mdPath, renderRecordMarkdown(record), io);
  if (mdError) return mdError;
  return null;
}

function resultPayload(jsonPath, mdPath, record, extra = {}) {
  return {
    campaign_dir: record.campaign_dir || extra.campaignDir,
    json: jsonPath,
    md: mdPath,
    state: record.state,
    speaker: record.speaker,
    under_floor: Boolean(record.under_floor),
    ...extra,
  };
}

function emptyRecord({ campaignDir, speaker, opened }) {
  const slug = speakerSlug(speaker);
  return {
    kind: "voice-interview",
    campaign: companySlug(campaignDir),
    campaign_dir: campaignDir,
    speaker,
    speaker_slug: slug,
    opened: opened || todayStamp(),
    state: "open",
    host_session_id: null,
    voice_url: null,
    call_ids: [],
    transcript_json: null,
    transcript_md: null,
    word_count: null,
    under_floor: false,
    voice_dna_path: null,
  };
}

function supersedeEntry(campaignDir, speaker, entry) {
  const opened = entry.data.opened || todayStamp();
  const dest = voiceRecordPair(campaignDir, speaker, `${opened}-superseded`);
  entry.data.state = "superseded";
  const written = writePair(dest.json, dest.md, entry.data);
  if (written?.error) return written;
  if (path.resolve(entry.json) !== path.resolve(dest.json) && fs.existsSync(entry.json)) {
    fs.unlinkSync(entry.json);
    if (fs.existsSync(entry.md)) fs.unlinkSync(entry.md);
  }
  return { retired_json: dest.json, retired_md: dest.md };
}

export function createRecord({ campaignDir, speaker, date } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const pair = voiceRecordPair(campaignDir, speaker, date);
  const retired = [];
  for (const entry of listVoiceEntries(campaignDir, speaker)) {
    if (entry.data.state === "superseded") continue;
    const moved = supersedeEntry(campaignDir, speaker, entry);
    if (moved?.error) return moved;
    retired.push(moved.retired_json);
  }
  const record = emptyRecord({ campaignDir, speaker, opened: date || todayStamp() });
  const created = writePair(pair.json, pair.md, record);
  if (created?.error) return created;
  return resultPayload(pair.json, pair.md, record, {
    campaignDir,
    retired_path: retired[0] || null,
    retired_paths: retired,
  });
}

export function setState({ campaignDir, speaker, state, acceptUnderFloor = false } = {}) {
  if (!speaker) return { error: "speaker_required" };
  if (!state) return { error: "state_required" };
  if (!RECORD_STATES.includes(state)) {
    return { error: "illegal_state_transition", extra: { to: state } };
  }
  const entry = findActiveRecordEntry(campaignDir, speaker);
  if (!entry) return { error: "record_not_found" };
  const from = entry.data.state;
  const allowed = LEGAL_TRANSITIONS[from] || [];
  if (!allowed.includes(state)) {
    return { error: "illegal_state_transition", extra: { from, to: state } };
  }
  if (state === "extracted" && entry.data.under_floor && !acceptUnderFloor) {
    return { error: "under_floor_unresolved", extra: { word_count: entry.data.word_count } };
  }
  entry.data.state = state;
  const written = writePair(entry.json, entry.md, entry.data);
  if (written?.error) return written;
  return resultPayload(entry.json, entry.md, entry.data, { campaignDir });
}

export function saveRecord(entry) {
  return writePair(entry.json, entry.md, entry.data);
}

export function listRecords({ campaignDir, speaker } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const entries = listVoiceEntries(campaignDir, speaker).map((entry) => ({
    json: entry.json,
    md: entry.md,
    state: entry.data.state,
    speaker: entry.data.speaker,
    opened: entry.data.opened,
    under_floor: Boolean(entry.data.under_floor),
  }));
  return { campaign_dir: campaignDir, speaker, records: entries };
}

export function showRecord({ campaignDir, speaker } = {}) {
  if (!speaker) return { error: "speaker_required" };
  const entry = findActiveRecordEntry(campaignDir, speaker);
  if (!entry) return { error: "record_not_found" };
  return resultPayload(entry.json, entry.md, entry.data, {
    campaignDir,
    record: entry.data,
    paths: {
      record: voiceRecordPair(campaignDir, speaker, entry.data.opened),
      transcript: voiceTranscriptPair(campaignDir, speaker, entry.data.opened),
      voice_dna: voiceDnaPath(campaignDir, speaker),
      archive: voiceArchiveDir(campaignDir),
    },
  });
}

export { voiceArchiveDir, voiceDnaPath, voiceRecordPair, voiceTranscriptPair };
