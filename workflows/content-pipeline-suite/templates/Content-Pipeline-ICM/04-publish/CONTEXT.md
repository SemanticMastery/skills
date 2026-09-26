# 04-publish — Stage Context

## Job

Hold final CMS-ready articles and images from `3.5-images`. In the **template**, this stage is platform-agnostic. When a campaign copy is deployed, update this file with the campaign’s publishing platform, API/MCP, and push steps.

## Inputs

- Publication Asset (with images) + Image Manifest (+ Technical Suite) from `03-write/3.5-images/post-{NN}-images/` (`post-{NN}-images.md` and `post-{NN}-img-*.png`)
- Optional: polish package from `03-write/3.4-polish/` if images were skipped by explicit override
- Optional publish metadata (slug, status, scheduled date) if provided
- **Campaign deploy only:** platform credentials / MCP / API details (not part of the blank template)

## Process

1. Accept only image-complete (or explicitly approved) packages—not drafts or mid-produce artifacts.
2. Keep a clear inventory of publish-ready vs published.
3. **Template default:** store assets here for manual copy/paste into the CMS. Do not invent a platform integration.
4. **Campaign customization (later):** document the target platform and wire API/MCP push steps in this CONTEXT without changing `01`–`03` stages.

## Outputs

- Publish-ready article pack (files + status notes)
- After campaign wiring: published confirmation / URLs from the platform

## Notes

- Keep this stage focused on its one job.
- Point agents here from the root `CONTEXT.md` task table.
- Platform choice is campaign-specific; leave this CONTEXT generic until deploy.
