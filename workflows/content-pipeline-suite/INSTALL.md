# Install — Content Pipeline Suite

Flatten this folder into your host skills root. Cursor and Claude Code load `SKILL.md` only when the folder name equals `name:` and the folder sits directly under the skills root. Pointing a host at `workflows/content-pipeline-suite/` does not load these skills.

`git pull` updates this clone. It does not refresh skills already flattened. Run flatten again, then restart the host.

## Where skills go

`HOST_SKILLS_ROOT`, when set, is the only destination.

When it is unset, flatten writes both user roots:

| Host | Default |
|------|---------|
| Cursor | `%USERPROFILE%\.cursor\skills` (macOS/Linux: `~/.cursor/skills`) |
| Claude Code | `%USERPROFILE%\.claude\skills` (macOS/Linux: `~/.claude/skills`) |

Each skill lands at `<host-skills-root>/<skill-name>/SKILL.md`. Companions are included. `voice-extractor` is a sibling of `voice-interview`, not an init class.

## Flatten

From this folder:

```powershell
.\scripts\flatten-install.ps1
```

```sh
sh scripts/flatten-install.sh
```

The script overwrites the same `<skill-name>/` folder on update. A versioned folder name such as `content-pipeline-init-v1.2.0` is rejected.

Restart Cursor or Claude Code after flatten.
