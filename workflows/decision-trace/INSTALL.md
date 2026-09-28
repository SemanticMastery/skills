# Install the decision-trace bundle

These three skills install as siblings. `/dtc-video` expects `cognee-decision-trace-capture` next to it. `video-feedback` is optional.

## Prerequisites

- Cap MCP or the `cap` CLI, for `/dtc-video`
- A Cognee MCP with `remember` and `recall`
- A CRM resolver, optional. Without one, the governor reads a campaign override file or asks for IDs
- Video tooling, optional, and only for on-screen evidence. The video skill asks before it installs anything

## Primary: flatten

From this folder, set `HOST_SKILLS_ROOT` to your host skills directory, then run one of:

- Windows: `scripts/flatten-install.ps1`
- macOS or Linux: `scripts/flatten-install.sh`
- Any OS: `node scripts/flatten-install.mjs`

Do not run the flatten script without `HOST_SKILLS_ROOT` on a machine that already uses these skills. The default destination is your user skills folder.

## Fallback: zip

Expand `decision-trace-v<version>.zip` into the same host skills folder. The archive contains three sibling folders and no extra wrapper.

## Check

You should have:

```text
<host-skills-root>/dtc-video/SKILL.md
<host-skills-root>/cognee-decision-trace-capture/SKILL.md
<host-skills-root>/video-feedback/SKILL.md
```

Open a campaign folder and run `/dtc-video` with a Cap URL, or `/capture-trace` with the decision in the conversation.
