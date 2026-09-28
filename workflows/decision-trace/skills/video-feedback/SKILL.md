---
name: video-feedback
description: >
  Analyze video feedback recordings (Cap or local MP4/MOV/WebM) to extract visual
  and audio insights, then produce actionable reports. Use when the user shares a Cap
  URL, provides a video file path, or says "analyze this video", "here's my feedback
  recording", "review this Cap", or any request to understand and act on video feedback.
  Supports screen recordings, UI walkthroughs, tutorial reviews, and general video feedback.
  For Cap URLs: prefer caps_context when transcript-only or decision-trace
  intake; run full frame pipeline only when visual/on-screen evidence is needed. Optional
  handoff to cognee-decision-trace-capture after the report.
metadata:
  version: "1.0.0"
---

# Video Feedback Analyzer


Analyze video recordings to extract what the user said (audio transcription) and what they showed (frame analysis), then produce an actionable feedback report tied to the relevant project context.

## 0. Route first (Cap MCP vs full pipeline)

**Before** prerequisites, download, or Whisper: classify intent and pick the cheapest path that satisfies it.

| Intent signal | Path | What to do |
|---------------|------|------------|
| Transcript-only, decision-trace intake, `/capture-trace`, "DTC from this Cap", "get the transcript" | **MCP-first** | Use `caps_get` then `caps_context` if available (see below). Skip yt-dlp/ffmpeg/frames unless user later asks for visuals. |
| "What was on screen", UI walkthrough, cursor/UI feedback, multimodal evidence | **Full pipeline** | Continue from §1 Prerequisites through Path A/B. Prefer MCP transcript as seed when Cap MCP/CLI works (skip Whisper if that transcript is solid). |
| Ambiguous | **Ask once** | "Transcript-only (faster, for decision trace) or full visual analysis?" Default to MCP-first if they mention SEO revision / decision / Cognee / DTC. |

### MCP-first (when `cap` MCP or CLI is available)

1. Parse Cap id from URL (`cap.so/s/{id}`, `cap.link/{id}`, `{host}/s/{id}`) or accept a bare id.
2. `caps_get` for metadata (`createdAt`, `durationMs`, title, `capabilities.download.allowed`).
3. Call **`caps_context`** for transcript + summary + chapters + comments.
4. If the user wants a **decision trace**: hand off to `dtc-video` (`/dtc-video`) or `cognee-decision-trace-capture` with the transcript as primary narrative evidence. Do **not** treat the transcript alone as a stored DecisionTrace. See `docs/dtc-video-integration.md`.
5. If the user wants a **feedback report** without frames: produce a transcript-based extract (timestamped quotes + actions) and stop. State that visuals were skipped.
6. Only if MCP/CLI fails (auth, missing tools, empty transcript) fall through to §1–§3 (yt-dlp / local file).

**Do not** auto-install packages or download MP4 when MCP-first already returned a usable transcript and the user did not request visual analysis.

### When full pipeline still wins

- User explicitly wants frames, UI review, or "what I pointed at"
- Transcript is too thin to act on without screen context
- Local file only (no Cap id) or non-Cap URL

Integration map: if `dtc-video` is installed, follow its integration notes for Patterns A and B.

## Architecture: Context-Efficient Pipeline

Two paths based on video length. Both keep images out of the main context.

**Path A -- Parallel (under 5 min):** Fast. Extract everything, sync after.

```
1. Download video + subtitles ──>
2. Extract metadata ────────────>
3. Extract frames ──┐
4. Extract audio ───┤ (parallel)
5. Transcript ──────┘             SRT from download (fast) or Whisper fallback
6. Analyze frames ──────────────>  ≤20 frames: read directly. >20: sub-agents.
7. Sync transcript + visual ────>
8. Produce actionable report
```

**Path B -- Audio-first (5 min or longer):** Smarter. Transcribe first, extract only the frames that matter.

```
1. Download video ──────────────>
2. Extract metadata ────────────>
3. Extract audio ───────────────>
4. Transcribe ──────────────────>
5. Identify feedback moments ───>  (analyze transcript for key timestamps)
6. Extract targeted frames ─────>  (only around feedback moments)
7. Batch frames ────────────────>  Sub-agents: read images, write text
8. Read text summaries <─────────  (image context discarded)
9. Sync transcript + visual ────>
10. Produce actionable report
```

For short videos (≤20 frames), read frames directly in the main context — sub-agent overhead is worse than the context cost. For longer videos, delegate to sub-agents to keep context lean.

## 1. Prerequisites

Check the dedicated virtualenv first, then the system PATH. Do not install into the global Python or into `~/mcp-venv`.

```bash
VENV="$HOME/.video-feedback/venv"
PYTHON="$(command -v "$VENV/bin/python3" 2>/dev/null || command -v "$VENV/Scripts/python.exe" 2>/dev/null || command -v python3)"
YTDLP="$(command -v "$VENV/bin/yt-dlp" 2>/dev/null || command -v "$VENV/Scripts/yt-dlp.exe" 2>/dev/null || command -v yt-dlp 2>/dev/null)"
which ffmpeg >/dev/null && which ffprobe >/dev/null && [ -n "$YTDLP" ] && $PYTHON -c "import whisper" 2>/dev/null && echo "All prerequisites OK (python=$PYTHON, yt-dlp=$YTDLP)" || echo "MISSING DEPENDENCIES (python=$PYTHON, yt-dlp=$YTDLP)"
```

**If `yt-dlp` or `whisper` are missing, stop and ask.** Name what will be installed and where. Do not install until the user says yes.

Ask text: install `yt-dlp>=2024.8.6` and `openai-whisper>=20231117` into `~/.video-feedback/venv` (a new virtualenv; not the global Python).

After yes:

```bash
python3 -m venv "$HOME/.video-feedback/venv"
"$HOME/.video-feedback/venv/bin/pip" install "yt-dlp>=2024.8.6" "openai-whisper>=20231117"
```

On Windows, use `"$HOME/.video-feedback/venv/Scripts/pip.exe"` for that install. Then re-resolve `$PYTHON` and `$YTDLP` from that venv.

**If `ffmpeg` or `ffprobe` are missing**, those are system packages. Name the install command and STOP. Do not run it:
- Linux: `sudo apt install ffmpeg`
- macOS: `brew install ffmpeg`
- Windows: install ffmpeg and add it to PATH

**If no Python is available to create the venv**, tell the user and STOP.

Use `$PYTHON` and `$YTDLP` throughout later commands.

## 2. Setup

Use a working-directory-relative temp folder so sub-agents have permission to read/write files.

```bash
TMPDIR="$(pwd)/.video-feedback-tmp"
mkdir -p "$TMPDIR"
rm -f "$TMPDIR"/frame_*.jpg "$TMPDIR"/scene_*.jpg "$TMPDIR"/targeted_*.jpg "$TMPDIR"/batch_*_analysis.md "$TMPDIR"/video.* "$TMPDIR"/audio.wav "$TMPDIR"/transcript.json
```

This clears all artifacts from previous runs so stale frames/transcripts from a longer video don't bleed into the current analysis.

**Important:** This directory must be inside the current working directory (not `/tmp/`) because sub-agents are sandboxed to the project directory and cannot access `/tmp/`.

## 3. Acquire Video

Determine the input type:

**If Cap URL** (matches `cap.so/s/`, `cap.link/`, or `{host}/s/{id}`) **and full pipeline is required** (visual analysis):

This skill owns Cap MP4 acquisition. Prefer the transcript already passed by `dtc-video` (or fetch via `caps_context` when invoked directly):

1. Write the passed transcript (or `caps_context` text) to `$TMPDIR/transcript-from-mcp.txt` for later sync.
2. Download the MP4 for frames. If that transcript is good, **skip Whisper** in A3/B2 even when SRT is missing — parse the seeded text into segments if timestamps exist, or use as a single narrative block paired with frames by time windows from Path B moment detection.

Then download for frames:

```bash
cap caps download <id-or-url> --output "$TMPDIR/video.mp4"
```

If `cap caps download` fails, report the Cap error and return so the caller (`dtc-video`) can fall back to Pattern A. Do not invent frames.

**If other video URL** (YouTube, Vimeo, etc.):

```bash
$YTDLP --force-overwrites --merge-output-format mp4 --write-subs --write-auto-subs --sub-lang en --convert-subs srt -o "$TMPDIR/video.mp4" "VIDEO_URL"
```

**If local file path** (ends in .mp4, .mov, .webm, .avi, .mkv):

```bash
cp "FILE_PATH" "$TMPDIR/video.mp4"
```

If the file doesn't exist, tell the user and STOP.

Set `VIDEO="$TMPDIR/video.mp4"` for all subsequent steps.

## 4. Extract Video Metadata

```bash
ffprobe -v quiet -print_format json -show_format -show_streams "$VIDEO"
```

Extract and note: duration, resolution (width x height), fps, codec, file size, whether audio is present.

If no video stream is found, report "audio-only file" and STOP.
If file size > 2GB, warn the user and suggest analyzing a time range.

## 5. Choose Pipeline Strategy

Based on duration from step 4, choose one of two paths:

| Duration | Strategy | Why |
|----------|----------|-----|
| **Under 5 minutes** | **Parallel** -- extract frames and audio simultaneously, sync after | Fast. Few enough frames that blanket extraction is cheap. |
| **5 minutes or longer** | **Audio-first** -- transcribe first, then extract targeted frames around feedback moments | Smarter. Avoids extracting hundreds of irrelevant frames. |

---

### Path A: Parallel Pipeline (under 5 minutes)

Use this path for short videos. Extract frames and audio at the same time, analyze everything, sync later.

#### A1. Extract Frames

Run frame extraction and audio extraction **in parallel** (both are independent).

Choose frame strategy based on duration:

| Duration | Strategy | Command |
|----------|----------|---------|
| 0-60s | 1 frame every 5s | `ffmpeg -hide_banner -y -i "$VIDEO" -vf "fps=1/5,scale='min(1280,iw)':-2" -q:v 5 "$TMPDIR/frame_%04d.jpg"` |
| 1-5min | Scene detection (threshold 0.3) | `ffmpeg -hide_banner -y -i "$VIDEO" -vf "select='gt(scene,0.3)',scale='min(1280,iw)':-2" -vsync vfr -q:v 5 "$TMPDIR/scene_%04d.jpg"` |

**Fallbacks:**
- Scene detection yields 0 frames -> retry with interval at 1 frame/5s
- More than 100 frames extracted -> subsample evenly to 80
- Frame extraction fails -> fall back to interval strategy (1 frame/5s)

After extraction, list all frame files and calculate each frame's timestamp from its sequence number and the extraction rate.

#### A2. Extract Audio (run in parallel with A1)

If metadata shows audio is present:

```bash
ffmpeg -hide_banner -y -i "$VIDEO" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$TMPDIR/audio.wav"
```

If no audio stream exists, skip transcription entirely and note "No audio track -- visual analysis only."

#### A3. Transcribe Audio

**Fast path -- use downloaded subtitles if available:**

Check for `$TMPDIR/video.en.srt` (downloaded from Loom/YouTube in step 3). If it exists, parse the SRT into segments and skip Whisper entirely:

```bash
$PYTHON -c "
import re, json
with open('$TMPDIR/video.en.srt') as f:
    content = f.read()
blocks = re.split(r'\n\n+', content.strip())
segments = []
for block in blocks:
    lines = block.strip().split('\n')
    if len(lines) >= 3:
        times = re.findall(r'(\d+):(\d+):(\d+)' + '[,.]' + r'(\d+)', lines[1])
        if len(times) >= 2:
            start = int(times[0][0])*3600 + int(times[0][1])*60 + int(times[0][2]) + int(times[0][3])/1000
            end = int(times[1][0])*3600 + int(times[1][1])*60 + int(times[1][2]) + int(times[1][3])/1000
            text = ' '.join(lines[2:]).strip()
            if text:
                segments.append({'start': start, 'end': end, 'text': text})
with open('$TMPDIR/transcript.json', 'w') as f:
    json.dump({'segments': segments}, f, indent=2)
print(f'SRT parsed: {len(segments)} segments (Whisper skipped)')
"
```

**Fallback -- Whisper transcription (only if no SRT exists):**

```bash
$PYTHON -c "
import whisper, json
model = whisper.load_model('base')
result = model.transcribe('$TMPDIR/audio.wav', word_timestamps=True)
with open('$TMPDIR/transcript.json', 'w') as f:
    json.dump(result, f, indent=2)
print('Transcription complete:', len(result['segments']), 'segments')
"
```

Then read `$TMPDIR/transcript.json`. Each segment has `start`, `end`, and `text` fields.

#### A4. Analyze Frames

**Choose strategy based on frame count:**

| Frames | Strategy | Why |
|--------|----------|-----|
| **20 or fewer** | **Direct** -- read frames in the main context | Sub-agent overhead (~2 min each) far exceeds the context cost of <20 images. Faster by 2-3 minutes. |
| **More than 20** | **Sub-agents** -- delegate to parallel sub-agents | Keeps main context lean for longer videos with many frames. |

**For 20 or fewer frames:** Read each frame directly using the Read tool. For each frame, note what's visible (UI elements, text, cursor position, changes from previous frame). Then proceed to **step 7** (Synthesize).

**For more than 20 frames:** Proceed to **step 6** (Delegate Frame Analysis).

---

### Path B: Audio-First Pipeline (5 minutes or longer)

Use this path for longer videos. Transcribe first, identify the moments that matter, then extract frames only around those moments.

#### B1. Extract Audio

```bash
ffmpeg -hide_banner -y -i "$VIDEO" -vn -acodec pcm_s16le -ar 16000 -ac 1 "$TMPDIR/audio.wav"
```

If no audio stream exists, fall back to **Path A** frame extraction strategies (keyframes for 5-30min, thumbnail filter for 30min+) and skip transcription. Note "No audio track -- visual analysis only."

#### B2. Transcribe Audio

**Fast path -- use downloaded subtitles if available** (same as A3):

Check for `$TMPDIR/video.en.srt`. If it exists, parse the SRT into segments and skip Whisper. See the SRT parsing script in step A3.

**Fallback -- Whisper transcription (only if no SRT exists):**

```bash
$PYTHON -c "
import whisper, json
model = whisper.load_model('base')
result = model.transcribe('$TMPDIR/audio.wav', word_timestamps=True)
with open('$TMPDIR/transcript.json', 'w') as f:
    json.dump(result, f, indent=2)
print('Transcription complete:', len(result['segments']), 'segments')
"
```

Read `$TMPDIR/transcript.json` and format the segments.

#### B3. Identify Feedback Moments

Analyze the transcript to find **feedback windows** -- clusters of segments where the user is actively giving feedback, pointing things out, or requesting changes. Look for:
- Evaluative language ("this should be", "I don't like", "change this", "the spacing here", "this is broken")
- Demonstrative references ("over here", "this button", "right here", "you can see")
- Transition phrases ("next thing", "also", "another issue", "moving on to")

Group nearby segments (within 5 seconds of each other) into windows. For each window, define an extraction range: **start timestamp minus 3 seconds** through **end timestamp plus 3 seconds** (clamped to video bounds). This captures the visual context the user was looking at while speaking.

Also include:
- The **first 5 seconds** of the video (establishes what page/app is being reviewed)
- Any **long silent gaps** (> 10 seconds) -- extract one frame from the midpoint (the user may be navigating without narrating)

#### B4. Extract Targeted Frames

For each feedback window, extract frames at 1 frame per 2 seconds within that range:

```bash
ffmpeg -hide_banner -y -i "$VIDEO" -vf "select='between(t\,START\,END)',scale='min(1280,iw)':-2" -vsync vfr -q:v 5 "$TMPDIR/targeted_%04d.jpg"
```

If multiple windows exist, either run one ffmpeg command with a combined select filter or run separate commands with distinct output prefixes.

**Target:** Aim for 30-60 total frames regardless of video length. If the feedback windows produce more, subsample evenly to 60.

#### B5. Delegate Frame Analysis

Proceed to **step 6** (Delegate Frame Analysis) with the targeted frames.

---

**Quality note for transcription:** If transcript quality is poor (garbled, missing words), the user can re-run with a larger model by setting `WHISPER_MODEL=small` or `WHISPER_MODEL=medium`. The base model is fastest but least accurate.

## 6. Delegate Frame Analysis to Sub-Agents

**Do NOT read frame images in the main conversation.** Split frames into batches and delegate to sub-agents.

### 6a. Prepare Batch Manifest

Split extracted frame files into batches of 8-10 frames each. For each batch, record:
- Batch number (1, 2, 3, ...)
- Frame file paths (absolute)
- Frame timestamps
- Output file path: `$TMPDIR/batch_N_analysis.md`

### 6b. Spawn Sub-Agents

For each batch, spawn a sub-agent with this prompt. **Launch all batches in parallel** -- they are fully independent.

#### Sub-Agent Prompt Template

```
You are analyzing frames extracted from a video feedback recording. The user was narrating feedback while navigating a UI or document. Pay special attention to:
- Where the mouse cursor is pointing (this indicates what the user is talking about)
- Any UI elements that appear highlighted, selected, or interacted with
- Visible text, labels, URLs, file names, error messages
- Changes between consecutive frames (what the user navigated to)

VIDEO: {filename}
DURATION: {duration}
BATCH: {batch_number} of {total_batches}

Read each frame image listed below using the Read tool. For each frame, write a structured description.

FRAMES:
{for each frame in batch}
- {absolute_path_to_frame} (timestamp: {MM:SS})
{end for}

For each frame, describe:
1. SCENE: What is visible (layout, UI elements, page/document structure)
2. CURSOR: Where the mouse cursor is positioned and what it's near/on
3. CONTENT: Text, code, labels, menus, URLs, or data visible on screen
4. ACTION: What changed since the likely previous frame
5. DETAILS: Error messages, button states, form values, anything notable

After describing all frames, add a BATCH SUMMARY section with:
- Content type (Screencast, UI Review, Document Review, Presentation, Tutorial, Other)
- Key UI elements or pages shown in this batch
- Any text/URLs/file names visible (quote exactly)

Write the complete analysis to: {TMPDIR}/batch_{N}_analysis.md
```

Use the Agent tool to spawn each sub-agent. If the tool supports parallel launches, launch all batches simultaneously.

**Fallback:** If sub-agents fail (permission errors, timeouts), read frames directly in the main context. Subsample to **20 frames maximum** -- pick every Nth frame to get even coverage. Warn about context usage for longer videos.

### 6c. Collect Results

After all sub-agents complete, read all batch analysis files in order:

```bash
ls "$TMPDIR"/batch_*_analysis.md
```

Read each file. These contain only text -- no images enter the main context.

## 7. Synthesize: Sync Transcript with Visual Analysis

This is the core value step. Merge the Whisper transcript (what the user said) with the frame analysis (what was on screen) into a unified timeline.

For each transcript segment:
1. Find the frame(s) closest in timestamp
2. Pair the spoken words with the visual context
3. Identify what the user was referring to based on cursor position + speech

Produce a **Feedback Extract** -- timestamped entries like:

```
[0:32] "This spacing is way too tight"
  -> Screen shows: Card grid with ~4px gap between items. Cursor positioned between two cards.
  -> Feedback: Increase spacing between grid items.

[1:15] "And this button should be more prominent"
  -> Screen shows: Muted gray CTA button, bottom-right of hero section. Cursor on the button.
  -> Feedback: Make CTA button more visually prominent (size, color, or contrast).
```

## 8. Resolve Project Context

Before generating the action plan, determine what project/files this feedback applies to:

1. **Check conversation context** -- if already working on a project in this session, map feedback to those files.
2. **Check user-provided context** -- the user may have prefixed their message with context like "Feedback on the event calendar mobile view."
3. **Use clues from the video** -- visible URLs, page titles, project names mentioned in narration, file paths shown on screen.
4. **Search if needed** -- use Glob/Grep to find relevant files based on clues from steps 1-3.
5. **If unclear** -- ask the user which project/files this applies to before proceeding.

**Important:** Not all feedback maps to code. It could be about a document, email draft, marketing plan, design, or anything else. Don't assume it's always a codebase change.

## 9. Produce Action Plan

Based on the feedback extract and resolved context, generate one of two outputs:

**For complex feedback** (multiple changes, new features, unclear scope, or new task kickoff):

```markdown
# Video Feedback Report: [brief description]

## Feedback Extract
[timestamped entries from step 9]

## Identified Changes
1. [Specific change] -- [which file/location if known]
2. [Specific change] -- [which file/location if known]
...

## Recommended Next Step
[Suggest: invoke brainstorming skill, create a plan, or list specific changes for approval]
```

**For simple feedback** (clear, small changes on a known project):

```markdown
# Video Feedback: [brief description]

## Changes to Make
1. [File: path] -- [specific change]
2. [File: path] -- [specific change]
...

Ready to implement these changes?
```

Choose simple vs. complex based on:
- Number of distinct changes (>3 = complex)
- Whether project context is clear (unclear = complex)
- Whether changes require design decisions (yes = complex)

## 10. Cleanup

The `.video-feedback-tmp/` directory is gitignored and will be overwritten on the next run. No cleanup needed -- leave the files in place. If the user explicitly asks to clean up, tell them to run `rm -rf .video-feedback-tmp` manually.

## 11. Optional handoff: decision-trace capture

This skill produces a feedback report, not a stored decision trace.

When the user wants the recording stored as a decision:

1. Keep the Feedback Extract (and the transcript, if used) as evidence.
2. Prefer `dtc-video` (`/dtc-video`) when the source is a Cap. That router packages the transcript, optionally this skill, and hands off.
3. Or invoke `cognee-decision-trace-capture` (`/capture-trace` or "capture this decision") with:
   - Primary narrative: transcript plus Feedback Extract
   - Campaign folder that owns `03-decisions/`, and order id if known
   - Alternatives, rationale, and constraints that were actually stated
4. Do not call Cognee `remember` from this skill. The capture skill owns the store, including the confirm-before-store step.
