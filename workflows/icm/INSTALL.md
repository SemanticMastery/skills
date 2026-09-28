# Install the ICM bundle

These three skills install as siblings. `/icm-setup` only works when `icm-architect` and `icm-migrate` sit next to it.

## Primary: flatten

From this folder, set `HOST_SKILLS_ROOT` to your host skills directory, then run one of:

- Windows: `scripts/flatten-install.ps1`
- macOS or Linux: `scripts/flatten-install.sh`
- Any OS: `node scripts/flatten-install.mjs`

Do not run the flatten script without `HOST_SKILLS_ROOT` on a machine that already uses these skills. The default destination is your user skills folder.

## Fallback: zip

Expand `icm-pack-v<version>.zip` into the same host skills folder. The archive contains three sibling folders and no extra wrapper.

## Check

You should have:

```text
<host-skills-root>/icm-setup/SKILL.md
<host-skills-root>/icm-architect/SKILL.md
<host-skills-root>/icm-migrate/SKILL.md
```

Open a folder and run `/icm-setup`.
