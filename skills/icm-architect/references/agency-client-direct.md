# Agency Client — Direct mode (`Client -> Campaign`)

White-label `Client -> Agency -> Campaign` is **out of scope**. This skill only scaffolds **Direct**.

## Always create

Under `{Client-Name}/{Campaign-Name}/`:

```text
01-intake/
02-deliverables/
03-decisions/
04-archives/
CAMPAIGN-CONTEXT.md
PROJECT-RULES.mdc
HOW-TO-WORK-THIS-PROJECT.md
```

Under `{Client-Name}/`:

```text
CLIENT-CONTEXT.md
```

Plus harness thin entrypoints at campaign root per `harness-map.md`.

## Default nested modules (full catalog)

**Default for every Agency Direct scaffold:** propose the **full** module set below — not a light subset mapped from interview services.

Empty folders are intentional. Local SEO / local marketing campaigns usually need these slots even if assets are not ready on day one. Prefer placeholders over numbering gaps.

### Canonical default tree (pre-omit)

```text
01-intake/
  1.1-docs/
  1.2-audit/
  1.3-logo/
  1.4-photos/
02-deliverables/
  2.1-links/
  2.2-press-releases/
  2.3-reports/
  2.4-schema/
  2.5-articles/
  2.6-gb-posts/
  2.7-social-posts/
03-decisions/
  3.1-communications/
  3.2-traces/
04-archives/
  troubleshooting/
```

### Module catalog (names are fixed; numbers may change after omit)

#### Intake (`01-intake/`)

| Module slug | Purpose |
|-------------|---------|
| `docs` | Contracts, briefs, SOWs, onboarding docs, client dossier |
| `audit` | SEO/site/local audits |
| `logo` | Brand marks / logo assets |
| `photos` | Photo / media intake |

#### Deliverables (`02-deliverables/`)

| Module slug | Purpose |
|-------------|---------|
| `links` | Link building / placements / citations (Agency Direct name; not Golden Image `tier1`) |
| `press-releases` | PR / press |
| `reports` | Recurring or one-shot reports |
| `schema` | Schema / structured data |
| `articles` | Article / blog content |
| `gb-posts` | Google Business Profile posts |
| `social-posts` | Social media posts (non-GBP) |

#### Decisions (`03-decisions/`)

| Module slug | Purpose |
|-------------|---------|
| `communications` | Client comms log / email / Slack / ClickUp threads worth keeping |
| `traces` | Decision traces / why-we-chose-X notes |

#### Archives (`04-archives/`)

| Module | Purpose |
|--------|---------|
| `troubleshooting/` | Debug notes, failed experiments, incident notes (unnumbered) |

## Propose → omit → renumber (required UX)

1. **Propose the full default tree** (canonical numbers above).
2. Ask: **“Omit any of these modules?”** (opt-out, not opt-in).
3. If the user omits one or more modules:
   - Drop those folders from the proposal.
   - **Renumber remaining modules sequentially within each parent stage** (`1.x`, `2.x`, `3.x` independently).
   - Keep the **slug** (name after the number); only the numeric prefix changes.
   - `troubleshooting/` stays unnumbered under `04-archives/`.
4. Re-show the full tree + file list with the new numbers before create approval.

### Renumber example

User omits `2.4-schema` and `2.6-gb-posts` from the default deliverables list:

```text
02-deliverables/
  2.1-links/
  2.2-press-releases/
  2.3-reports/
  2.4-articles/        ← was 2.5
  2.5-social-posts/    ← was 2.7
```

### Off-catalog modules

**Do not invent** folder names outside this catalog. If the user needs something unmapped, ask once; only add after explicit confirmation, then place it in order and renumber.

## Tools / services in the interview

Still collect tools/services (BrightLocal, Slack, etc.). Use them to:

- Fill `{{TOOLS_SERVICES}}`, task routing, and go-deeper rationale
- Annotate which default modules those tools land in

Do **not** use tools/services to shrink the default tree. Shrinking happens only via the omit step.

### Service → module annotation (for rationale / routing, not selection)

| If user mentions… | Annotate against |
|-------------------|------------------|
| docs, contract, brief, SOW, onboarding, dossier | `docs` |
| audit, technical SEO, site audit, local audit | `audit` |
| logo, brand mark | `logo` |
| photos, images, media kit | `photos` |
| links, link building, placements, citations, Yext, aggregators | `links` |
| press, PR, press release | `press-releases` |
| report, monthly report, ranking report, BrightLocal, RankPrompt | `reports` |
| schema, JSON-LD, structured data | `schema` |
| articles, blog, content writing | `articles` |
| GBP, Google Business, GMB posts | `gb-posts` |
| social posts, Instagram, Facebook, LinkedIn posts | `social-posts` |
| client emails, Slack, ClickUp, comms log | `communications` |
| decisions, decision log, traces | `traces` |
| troubleshooting, debug, incidents | `troubleshooting/` |

## Explicitly excluded

- Campaign workbook `.xlsx`
- `One-Off-Orders/`
- Agency layer folders
- Freeform module names not in the catalog (unless user explicitly confirms an add)

## Client-level defaults

- Default: client folder + `CLIENT-CONTEXT.md` as **campaign index only**
- **Do not suggest** `archived-campaigns/` under the client unless the user describes a **white-label** multi-agency scenario (out of scope for Direct scaffolding). Never place `archived-campaigns/` under a campaign folder.

## Business dossier (recommended)

A root **business dossier** (`*dossier*.md` or `*dossier*.docx`) is the preferred way to seed client/campaign CONTEXT.

- **If present at scaffold root:** greenfield preflight **allows** it (not a refuse trigger). Read it for display names, firmographics, tools/services, and CONTEXT fill. At write, **copy** into `01-intake/1.1-docs/` and keep the original at root unless the user asked to move it.
- **If missing:** suggest once that the user run a **business-dossier** skill (or drop an existing dossier into the folder) before or during the interview. Do not block the interview.
- Detection: filename contains `dossier` (case-insensitive); extensions `.md` or `.docx` only for this exception.

See `setup-interview.md` Phase B.

## Display names vs folder slugs

Collect **both** for client and campaign:

| Placeholder | Use for |
|-------------|---------|
| `{{CLIENT_NAME}}` / `{{CAMPAIGN_NAME}}` | Titles, prose, handoff |
| `{{CLIENT_FOLDER}}` / `{{CAMPAIGN_FOLDER}}` | Real directory names and Path columns |

**Slug rules:** no spaces; prefer `Title-Case-With-Hyphens` or `lowercase-with-hyphens`; strip characters unsafe for folders. Proposal trees must show the folder path, not only the display name.

## Templates

| File | Template |
|------|----------|
| `CLIENT-CONTEXT.md` | `templates/agency/CLIENT-CONTEXT.md` |
| `CAMPAIGN-CONTEXT.md` | `templates/agency/CAMPAIGN-CONTEXT.md` |
| `PROJECT-RULES.mdc` | `templates/agency/PROJECT-RULES.mdc` |
| `HOW-TO-WORK-THIS-PROJECT.md` | `templates/agency/HOW-TO-WORK-THIS-PROJECT.md` |

Placeholders: `{{CLIENT_NAME}}`, `{{CAMPAIGN_NAME}}`, `{{CLIENT_FOLDER}}`, `{{CAMPAIGN_FOLDER}}`, `{{GOAL}}`, `{{OUTCOME}}`, `{{TOOLS_SERVICES}}`, `{{MODULE_LIST}}`, `{{TASK_ROUTING_TABLE}}`, `{{WHY_STAGES_BLURB}}`, `{{HARNESS_NOTE}}`.

Fill `{{MODULE_LIST}}` from the **confirmed** (post-omit, post-renumber) tree.  
Fill `{{WHY_STAGES_BLURB}}` with a short, interview-specific rationale (why these stages/modules for this goal) — same substance as go-deeper, compressed for the handoff.

After write: verify no leftover `{{` in created files.
