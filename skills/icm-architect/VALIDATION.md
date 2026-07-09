# Validation — icm-architect (pre-share checklist)

Run before sharing a student zip or publishing the private repo.

## Frontmatter

- [ ] `SKILL.md` has `name: icm-architect`
- [ ] `description` mentions `/icm-architect`, ICM scaffold, WorkFlows, Agency Client
- [ ] `disable-model-invocation: true`

## Required files present

- [ ] `SKILL.md`, `INSTALL.md`, `setup-interview.md`, `COACHING-README.md`, `VALIDATION.md`
- [ ] `references/attribution.md`, `harness-map.md`, `interview-standard.md`, `go-deeper-guidance.md`
- [ ] `references/agency-client-direct.md`, `workflows-mode.md`, `confirm-checklist.md`
- [ ] `templates/agency/*`, `templates/workflows/*`, `templates/harness/*`

## Relative links

- [ ] Links from `SKILL.md` to setup/references/templates resolve inside the skill folder
- [ ] No broken paths that assume authoring-only `skills/icm-architect/` prefix at runtime

## Secret / absolute path scan

Search the skill tree for:

- [ ] No machine-local absolute user home paths (Windows `Users\<name>\...` or macOS/Linux `/Users/<name>/...`)
- [ ] No API keys, tokens, `.env` contents
- [ ] No private client names from live campaigns

PowerShell one-liner (from skill root):

```powershell
Get-ChildItem -Recurse -File | Select-String -Pattern 'Users\\[^\\]+\\|Users/[^/]+/|api[_-]?key|sk-[a-zA-Z0-9]{10,}'
```

## Behavioral smoke (manual)

- [ ] Empty dir → Agency + Cursor → full catalog proposed → omit optional → renumber → confirm → files match final proposal; no `{{` leftovers; handoff cites Clief Notes **and includes folder tree diagram**
- [ ] Empty dir → Agency → dossier suggest offered when no dossier present (non-blocking)
- [ ] Root `*dossier*.md` or `*dossier*.docx` only → preflight proceeds (not refuse); agent asks **human client** before paths; dossier pre-fills **campaign** only; copy into `{Person}/{Company}/01-intake/1.1-docs/` at write
- [ ] Agency with company dossier + “monthly retainer” → propose `{Person}/{Company}/`, **not** `{Company}/Marketing-Retainer/`
- [ ] Empty dir → WorkFlows + confirm-time rename → scaffold uses confirmed names; handoff includes folder tree diagram
- [ ] Confirm-time module omit/edit → re-propose with sequential numbers → write matches second proposal
- [ ] Substantial non-empty (non-dossier) → refuse writes
- [ ] Trivial `.git`/README → soft-warn, may proceed
- [ ] Claude harness → thin `CLAUDE.md` pointer; handoff notes best-effort
- [ ] Agency does not suggest `archived-campaigns/` unless white-label scenario described

## Zip layout

- [ ] Zip skill root contains `SKILL.md` at top of the zipped folder (no required `skills/` prefix for install)
- [ ] Expanding into `.cursor/skills/` yields `.cursor/skills/icm-architect/SKILL.md`

## Release sign-off

- [ ] `docs/student-distribution.md` followed
- [ ] Next-Thursday polish backlog listed
- [ ] Private repo publish done **or** zip-only fallback noted
