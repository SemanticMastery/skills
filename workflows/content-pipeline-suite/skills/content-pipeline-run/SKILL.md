---
name: content-pipeline-run
disable-model-invocation: true
description: >-
  Execute the campaign content pipeline produce stages: one slot through
  3.1-brief → 3.2-draft → 3.3-edit → 3.4-polish → 3.5-images → 3.6-schema.
  Reads each stage CONTEXT.md Agent prompt verbatim. Requires prior
  content-pipeline-init (init_complete), including the Editorial Roadmap
  and SiteSwarm tag taxonomy in 02-plan. Invoke-time gate_mode review|auto
  and copywriting_model (inherit, pin Cursor, or external/local in
  another app). Anthropic/Claude is prohibited. Cursor-session suggestion: Grok
  4.6 or ChatGPT-5.6 Terra. Does not publish, archive, or create the
  roadmap/taxonomy. Photo library is consumed at 3.5-images; first library
  build belongs after content-pipeline-init, not to the writing team.
  When the selected voice file is a person, company and crew work
  is we and that person's own actions are I. After images this skill
  continues into 3.6-schema and overwrites that post's JSON-LD.
  At the end, name the next steps: siteswarm-publish-kit, then
  content-pipeline-social when the campaign has the social add-on.
  Page produce does not roll into schema. (v1.6.4)
metadata:
  version: "1.6.4"
---

# Content Pipeline Run (Orchestrator)

Human-triggered orchestration for **one campaign / project folder**. Runs
produce stages under `06-content-pipeline/` after init has resources, the
Editorial Roadmap, and the SiteSwarm tag taxonomy.

| Rule | Detail |
|------|--------|
| **Campaign pin** | User must specify `campaign_dir` (or pipeline dir) at invoke time. Confirm absolute path before writes. |
| **Init gate** | Require `content-pipeline-init-manifest.json` `status: init_complete` **and** all 8 resource classes + `ai-isms.md` under `01-resources/` **and** `02-plan/editorial-roadmap.md` plus a SiteSwarm tag taxonomy. Else hard-stop → run `content-pipeline-init`. |
| **Gate mode** | Require `gate_mode: review \| auto` at invoke (ask once if omitted). Persist on run manifest. |
| **Copywriting model** | Require or ask `copywriting_model` at first run (and whenever the manifest field is missing). Offer **Cursor session** (inherit / pin) or **external/local** (another app already on the copy model). Cursor-session suggestion: **Grok 4.6** or **ChatGPT-5.6 Terra**. **Prohibit Anthropic/Claude** (watermarking) — refuse a pin and refuse `inherit` when this chat is already Claude. If they skip and this chat is not Anthropic: `inherit` + `session`. See [copywriting-model.md](references/copywriting-model.md). |
| **Prompt ownership** | Each stage: read that folder's `CONTEXT.md`, execute **Agent prompt** verbatim. Do not reimplement or rewrite prompts. |
| **One stage / one folder** | Write outputs only into the active stage folder (or path CONTEXT names). |
| **No skip** | Do not advance past empty upstream unless the operator explicitly overrides. |
| **One vertical slice** | After init left a roadmap: produce **one slot at a time**. Do not batch all weeks in one invoke. |
| **Plan is init-owned** | Do not write `editorial-roadmap.md` or `siteswarm-tag-taxonomy.md`. Missing or rebuild → `content-pipeline-init`. |
| **Stop after schema** | Hard-stop after `3.6-schema`. After images, continue into schema in the same run. Schema reads `02-deliverables/2.4-schema` and overwrites this post’s JSON-LD. Do not write `04-publish/` or `05-archives/`. Page produce (`content-pipeline-pages`) does not roll into schema. |
| **Photo library** | **Consume only.** `3.5-images` runs `{pipeline_dir}/scripts/match-library.mjs` then `{pipeline_dir}/scripts/fal-generate.mjs` on miss. Those files are seeded by `content-pipeline-photo-library`. If they are missing, run `node …/content-pipeline-photo-library/scripts/seed-helpers.mjs --campaign-dir "…"` — do not hard-stop because the installed skills folder is missing. First ingest/HITL is setup (the operator). Empty approved is a Fal miss, not a hard-stop. |
| **Manifest SoT** | `{campaign_dir}/06-content-pipeline/content-pipeline-run-manifest.json` |
| **Planning files** | Prefer `{campaign_dir}/04-archives/planning/` for task/findings/progress when that tree exists. |

Companion (prerequisite): **`content-pipeline-init`** — fills `01-resources/` and writes `02-plan/` roadmap + SiteSwarm taxonomy. This skill does not call research companions or paid APIs, and does not create the plan.

Setup companion (setup, not this skill): **`content-pipeline-photo-library`** — the operator runs it after init so writers already have `approved/` photos. Run does not own that HITL.

## When to use

- User says **content pipeline run** / **run content pipeline** / **content-pipeline-run**
- User names an explicit **campaign or project directory** with `06-content-pipeline/` already initialized
- Do **not** use this skill to build the photo library — that is `content-pipeline-photo-library` after init

## References

1. [references/stage-map.md](references/stage-map.md)
2. [references/artifact-naming.md](references/artifact-naming.md)
3. [references/gate-modes.md](references/gate-modes.md)
4. [references/copywriting-model.md](references/copywriting-model.md)
5. [references/run-manifest-schema.md](references/run-manifest-schema.md)
6. [references/subagent-stage.md](references/subagent-stage.md)
7. [references/brainrot-shorts-test.md](references/brainrot-shorts-test.md) — optional local shorts test (not a produce stage)
8. [references/voice-dna.md](references/voice-dna.md) — optional author/brand Voice DNA before draft

## Scripts

Skill root = this folder (next to `SKILL.md`).

| Script | Purpose |
|--------|---------|
| `scripts/check-ready.mjs` | Validate init_complete + 8 resources + ai-isms; print JSON. Refreshes the story bank when a series record exists (optional; never a blocker). |
| `scripts/status-run.mjs` | Print run manifest status + next_action + artifact hints |
| `scripts/advance-run.mjs` | Init/update run manifest (approve, set-slot, mark-complete, copywriting model, …) |
| `scripts/nest-post-artifacts.mjs` | Nest polish/images (and any post with >1 file) into `post-{NN}-{stage}/` |
| `scripts/fal-generate.mjs` | Generate one PNG via Fal.ai (`FAL_AI_API_KEY` or `FAL_KEY`; default `fal-ai/flux-2-pro`) |
| local REST CLI (not in this folder) | `.cursor/scripts/brainrot/cli.mjs` — optional shorts test via `BRAINROT_API_KEY` |

Run with **Node.js 20+**. Pass absolute `--campaign-dir`.

```bash
node scripts/check-ready.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/status-run.mjs --campaign-dir "/abs/path/to/campaign"
node scripts/advance-run.mjs --campaign-dir "/abs/path/to/campaign" --init --gate-mode review --copywriting-model inherit
node scripts/fal-generate.mjs --prompt "photoreal tree crew..." --out "/abs/path/to/post-01-img-01.png" --aspect 16:9
```

---

## Step 0 — Resolve and confirm

1. Require explicit `campaign_dir` (folder containing `06-content-pipeline/`, or the pipeline folder itself).
2. Confirm absolute path before writes.
3. Require or ask **`gate_mode`**: `review` or `auto` (see [gate-modes.md](references/gate-modes.md)).
4. Require or ask **`copywriting_model`** when the manifest field is missing (see [copywriting-model.md](references/copywriting-model.md)):
   - **Cursor session — inherit** — use the model already running this chat. `copywriting_via=session`. Recommended when this chat is already **Grok 4.6** or **ChatGPT-5.6 Terra**. If this chat is Claude/Anthropic: **stop** — do not inherit, do not write copy. Ask them to switch this chat to Grok 4.6 or ChatGPT-5.6 Terra.
   - **Cursor session — pin** — they name a Cursor-dispatchable id. Suggest **`cursor-grok-4.6-high-fast`** (Grok 4.6) or **`gpt-5.6-terra-medium`** (ChatGPT-5.6 Terra). Other non-Anthropic Cursor slugs are OK if they name one. `copywriting_via=session`.
   - **External / local** — they will run **03-write** (brief→polish) in another agent already on the copy model. Persist the model id, `copywriting_via=external`, and an optional `copywriting_host` label. **Do not write those stages in this chat.** Use this only when the operator has that local host — team members on Cursor-only should use the session options above.
   - **Anthropic is prohibited.** Do not pin, inherit, Task-dispatch, or silently substitute Claude / Sonnet / Opus / Haiku / any Anthropic id. If they skip and this chat is not Anthropic: `inherit` + `session`.
5. Create/update run manifest:

```bash
node scripts/advance-run.mjs --campaign-dir "..." --init --gate-mode review --copywriting-model inherit
# Cursor pin examples (team / no local models):
# --copywriting-model cursor-grok-4.6-high-fast
# --copywriting-model gpt-5.6-terra-medium
# External copywriter example (operator has local-model access):
# --copywriting-model <model-id> --copywriting-via external --copywriting-host <label>
```

6. Optionally create planning trio under `04-archives/planning/` for long runs.

## Step 1 — Ready check

```bash
node scripts/check-ready.mjs --campaign-dir "..."
```

If not ready: hard-stop. Tell the operator to run **content-pipeline-init**. Do not invent research files.

## Step 2 — Confirm plan artifacts (`02-plan`)

Plan and SiteSwarm taxonomy are **init-owned**. This step only records them on the run manifest.

1. If `02-plan/editorial-roadmap.md` **and** a SiteSwarm taxonomy are present: mark plan complete / approved (`--mark-complete plan`, `--set-siteswarm-taxonomy` with the existing path) and continue to slot selection.
2. If either file is missing: hard-stop. Tell the operator to run **content-pipeline-init** (Steps 6–7). Do not write a roadmap or invent tags here.
3. Rebuild / horizon change: send them back to **content-pipeline-init**. Do not recreate `run:plan` or `run:siteswarm_tags`.

## Step 3 — Select slot

1. Ask for Post # (or “next incomplete”). Capture week, title, trigger word from the roadmap row.
2. Record slot:

```bash
node scripts/advance-run.mjs --campaign-dir "..." --set-slot --post N --week W --title "..." --trigger "..."
```

3. Produce **only this slot** through schema in this invoke (or until review / external pause). If `copywriting_via=external`, stop after set-slot and hand off the **entire** 3.1→3.4 chain (`await_external:write`). The operator stays in the external host through polish. Do not write 03-write copy here and do not call them back after each stage.

## Step 4 — Produce chain (`3.1` → `3.6`)

For each stage in order: **brief → draft → edit → polish → images → schema**:

1. Verify upstream artifact exists (see [artifact-naming.md](references/artifact-naming.md)).
2. **Before `draft`:** resolve Voice DNA per [voice-dna.md](references/voice-dna.md). Zero files → default professional. One file → use it. Two or more → ask which to use as the author voice, then proceed. Do not skip a present `*voice-dna*` file. When that file is a person, company and crew work is we / us / our and that person's own role, calls, and arrival are I / me / my. Do not name that person in the third person. Do not import filler words or a personal biography unless the operator asks. Edit and polish keep that speaker, including not smoothing I back into a name.
3. Read that stage's `CONTEXT.md`; follow Agent prompt verbatim.
4. **Copy stages** (`brief` / `draft` / `edit` / `polish`): apply [copywriting-model.md](references/copywriting-model.md). Refuse Anthropic/Claude (pin or inherit-on-Claude). If `copywriting_via=external`, print **one** handoff for 3.1→3.4, `--await-external write`, and **stop** — do not write copy here, do not Task-dispatch, and do not resume until polish exists. If `via=session` and a pinned id is not dispatchable, stop — do not substitute another model (never substitute Claude).
5. **`images`:** ignore the copywriting pin (orchestrator + library matcher + Fal). Always run here, including after an external polish. Consume `approved/` if present; Fal-miss if empty. Do not start photo-library ingest/HITL. Then continue to schema.
6. **`schema`:** read `3.6-schema/CONTEXT.md` and follow it. Overwrite this post’s JSON-LD in `02-deliverables/2.4-schema/blog/` when that slug’s file is already there. Do not call SiteSwarm.
7. Write the named artifact into that stage folder only.
8. Update manifest (`--mark-complete` or `--await-approval`).
9. **`review`:** set awaiting approval and **stop the turn** until the operator says proceed/revise.
10. **`auto`:** continue to the next stage unless blocked/failed.

Optional: dispatch a stage via Task subagent using [subagent-stage.md](references/subagent-stage.md). Pass the pinned copywriting model on copy stages.

## Step 5 — Complete (slot)

After schema:

```bash
node scripts/advance-run.mjs --campaign-dir "..." --produce-complete
```

Report artifact paths. This skill does not publish the post and does not write `04-publish/` or `05-archives/`.

Tell the operator these next steps, in this order. Do not start either skill in this run. The post has to be published before social can match it.

1. Run **siteswarm-publish-kit** for this slot. That skill publishes the post to the blog.
2. Run **content-pipeline-social** only when this client or campaign has the social posting add-on. That skill saves unpublished channel drafts after the article is on the production blog.

Optional (operator-triggered only): test a Brainrot vertical short from the polish file. See [brainrot-shorts-test.md](references/brainrot-shorts-test.md). Do not invent a `3.6-video` stage.

To produce another post: new slot selection on a later invoke (or after clear + set-slot).

## Resume

On re-invoke:

```bash
node scripts/status-run.mjs --campaign-dir "..."
```

Honor `next_action`, `copywriting_model`, and `copywriting_via`. If `next_action` is `blocked:need_init_plan` (roadmap or taxonomy missing), tell them to run **content-pipeline-init**. If `copywriting_model` is missing, ask before writing more copy (do not silently assume Claude or inherit on an old manifest). If the stored pin is Anthropic/Claude, or `inherit` while this chat is Claude/Anthropic: **stop** — do not write copy. Ask them to switch to Grok 4.6 or ChatGPT-5.6 Terra (or pin `cursor-grok-4.6-high-fast` / `gpt-5.6-terra-medium`). If `next_action` is `await_external:write` and polish exists (with brief/draft/edit), `--ingest-external-write` then continue to images and then schema (or one polish approval in `review`). If polish is missing, stay handed off — do not write 03-write copy here. Do not redo `complete` stages unless the operator requests rewrite.

## Out of scope

- Resource init / companion research skills / paid API calls
- Editorial roadmap or SiteSwarm tag taxonomy create/rebuild (that is `content-pipeline-init`)
- First photo-library ingest / classify / HITL (setup operator after init; writers consume only)
- Rewriting stage CONTEXT prompts
- Batch-producing all roadmap posts in one invoke
- CMS push, `04-publish` posts, and `05-archives` stay out of this run. The closing message still names **siteswarm-publish-kit**, then **content-pipeline-social** when the social posting add-on applies.
