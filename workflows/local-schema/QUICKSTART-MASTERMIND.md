# Local Schema Generator — Mastermind quickstart

**Workflow ID:** `local-schema`  
**Bundle:** `local-schema-20260926.zip` · **`schema-markup-generator` 9.15.1**  
**Catalog:** clone [SemanticMastery/skills](https://github.com/SemanticMastery/skills) and open `workflows/local-schema/`. The zip still installs the same three skills; see [INSTALL.md](INSTALL.md).

Full details: [INSTALL.md](INSTALL.md)

**Upgrading from an older zip:** overwrite the three skill folders under `~/.cursor/skills/` (especially `schema-markup-generator`) and restart Cursor so intake gates 0b/0c load.

---

## What you get

Three agent skills + dossier scripts:

| Install folder name | Purpose |
|---------------------|---------|
| `schema-markup-generator` **9.15.1** | JSON-LD (FAQ, service pages, LocalBusiness, etc.) — asks for `sameAs` + logo/image/geo before local homepage schema |
| `knowsabout-entity-research` | Entity CSV for service/location pages |
| `business-dossier` | Glen Patel TSCR business dossier (optional; needs API keys) |

---

## 5-minute setup (Cursor)

1. **Unzip** anywhere (e.g. `C:\Users\You\local-schema` or `~/local-schema`).

2. **Set bundle root** (one-time per terminal session, or add to your profile):

   **Windows (PowerShell):**
   ```powershell
   $env:BUNDLE_ROOT = "C:\path\to\unzipped\local-schema"
   ```

   **macOS / Linux:**
   ```bash
   export BUNDLE_ROOT="/path/to/unzipped/local-schema"
   ```

   The unzipped folder must contain `skills/` and `scripts/` at the top level.

3. **Copy skills** into Cursor global skills:

   | OS | Copy `skills\*` into |
   |----|----------------------|
   | Windows | `%USERPROFILE%\.cursor\skills\` |
   | macOS / Linux | `~/.cursor/skills/` |

   You should end up with three folders: `schema-markup-generator`, `knowsabout-entity-research`, `business-dossier`.

4. **Node (for dossier / entity resolver later):**
   ```bash
   cd "$BUNDLE_ROOT/scripts/seo"
   npm install
   ```
   (No npm packages required today; this confirms the folder is ready.)

5. **Restart Cursor** so skills reload.

---

## First test (no API keys required)

Open any project folder and ask:

> Generate **FAQ-only** JSON-LD for this page. Skip business dossier and entity CSV prefights.

If the agent finds `schema-markup-generator`, setup worked.

---

## When you need API keys (full contractor path)

| Variable | For |
|----------|-----|
| `GROK_API_KEY` | Business dossier (Grok synthesis) |
| `SERPAPI_API_KEY` | Dossier pre-gather + GBP |
| Firecrawl CLI (`firecrawl --status`) | Website/review pre-gather |

Set in **Windows User environment** or shell profile, then restart Cursor.

**Important:** `business-dossier` and `knowsabout-entity-research` do **not** auto-run. The schema skill will **stop** and tell you to invoke them by name.

---

## Typical workflow order (service page)

1. Confirm NAPW + GBP URL → invoke **business-dossier** → wait for `{Name} Dossier.md`.
2. Invoke **knowsabout-entity-research** if `resources/schema/knowsabout/{slug}-knowsabout.csv` is missing.
3. Invoke **schema-markup-generator** for the page.

FAQ / Article-only pages: step 1–2 can be skipped if you say FAQ-only.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Skill not found | Folder names must match exactly; restart Cursor |
| Script path errors | Set `BUNDLE_ROOT` to the unzip root (folder with `skills/` + `scripts/`) |
| Dossier won’t run | Set `GROK_API_KEY`; use `--dry-run` per [INSTALL.md](INSTALL.md) |
| `.docx` fails on Mac | Markdown dossier still works; DOCX zip step is Windows-oriented today |

---

## Security & license

- [SECURITY-STUDENTS.md](SECURITY-STUDENTS.md) — what runs on your machine  
- [NOTICE](NOTICE) / [LICENSE](LICENSE) — Apache + SemanticMastery attribution  

Report bugs in the mastermind channel; Bradley will patch the zip or repo.
