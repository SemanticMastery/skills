# Interview voice host

**Semantic Mastery Mastermind** — Bradley Benner  
**License:** For enrolled students only. Not for public resale or redistribution outside the program.

One Cloudflare Worker + SQLite Durable Objects that hosts **all three** interview kinds on the same deploy:

| Kind | Link shape | Retell template | Skill |
|------|------------|-----------------|-------|
| Owner (facts) | `/s/{session}` and `/i/{agency}/{session}` | `retell/` | `owner-interview` |
| Expert (stories) | `/e/{agency}/{token}` | `retell/expert/` | `expert-interview` |
| Voice DNA (how they sound) | `/v/{agency}/{session}` | `retell/voice/` | `voice-interview` |

Nothing here is hosted for you. You deploy this to **your own** Cloudflare account with **your own** Retell AI key.

> Full walkthrough: `tutorial/09-retell-voice-setup.md` in the suite package.

## What you need

| Thing | Why |
|-------|-----|
| Cloudflare account (free plan is enough to start) | Hosts the Worker + Durable Objects |
| Retell AI account + API key | Runs the voice agents |
| Node.js 20+ | `wrangler` and the setup script |

Durable Objects with SQLite storage are available on the Workers free plan. Retell bills per voice minute.

## Deploy

```bash
npm install
npx wrangler login          # pick YOUR Cloudflare account
npm run vendor-sdk          # bundles the pinned Retell browser SDK into public/
npx wrangler deploy
```

Note the deployed URL — everything below calls it `https://<your-worker>`.

If you attach a custom domain, set `vars.PUBLIC_ORIGIN` to that `https://` origin so series links are not `*.workers.dev`. `PUBLIC_ORIGIN` must match the hostname clients open.

## Secrets

```bash
npx wrangler secret put RETELL_API_KEY
npx wrangler secret put OWNER_INTERVIEW_HOST_TOKEN
npx wrangler secret put RETELL_WEBHOOK_KEY
```

| Secret | Required | What it is |
|--------|----------|------------|
| `RETELL_API_KEY` | yes | From your Retell dashboard |
| `OWNER_INTERVIEW_HOST_TOKEN` | yes | A long random string **you invent**. Both skills use it to call `/admin/*`. |
| `RETELL_WEBHOOK_KEY` | optional | Signs Retell webhooks. If unset, HMAC falls back to `RETELL_API_KEY`. |

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Max 256 }))
```

For local `wrangler dev`, copy `.dev.vars.example` to `.dev.vars`. Never commit `.dev.vars`.

## Create the three Retell agents (same Worker)

Owner agent (default template):

```bash
node scripts/setup-agent.mjs --worker-url https://<your-worker> --apply
```

Expert agent (second template, same host):

```bash
node scripts/setup-agent.mjs --template retell/expert --worker-url https://<your-worker> --apply
```

Voice DNA agent (third template, same host):

```bash
node scripts/setup-agent.mjs --template retell/voice --worker-url https://<your-worker> --apply
```

Put the printed ids in `wrangler.jsonc`:

- owner → `vars.RETELL_AGENT_ID`
- expert → `vars.RETELL_EXPERT_AGENT_ID`
- voice → `vars.RETELL_VOICE_AGENT_ID`

Then redeploy. Confirm all three webhooks point at `https://<your-worker>/retell/webhook`.

```bash
node scripts/setup-agent.mjs --worker-url https://<your-worker> --verify
node scripts/setup-agent.mjs --template retell/expert --worker-url https://<your-worker> --verify
node scripts/setup-agent.mjs --template retell/voice --worker-url https://<your-worker> --verify
```

Ask before every `--apply`. Dry-run (no flags) touches nothing.

## Point the skills at your host

User environment variables, not files in a synced folder:

| Variable | Value |
|----------|-------|
| `RETELL_API_KEY` | same key you gave the Worker |
| `OWNER_INTERVIEW_HOST_TOKEN` | same token you gave the Worker |
| `OWNER_INTERVIEW_HOST_URL` | `https://<your-worker>` (or your public origin) |
| `EXPERT_INTERVIEW_HOST_URL` | optional; falls back to `OWNER_INTERVIEW_HOST_URL` |

## Config

| Var | Default | Meaning |
|-----|---------|---------|
| `RETELL_AGENT_ID` | placeholder | Owner agent from `--apply` |
| `RETELL_EXPERT_AGENT_ID` | placeholder | Expert agent from `--template retell/expert --apply` |
| `RETELL_VOICE_AGENT_ID` | placeholder | Voice agent from `--template retell/voice --apply` |
| `PUBLIC_ORIGIN` | placeholder | Origin printed on `/e/` series links and `/v/` voice links |
| `LINK_EXPIRY_DAYS` | `7` | How long an owner `/s/` link stays usable |
| `VOICE_LINK_EXPIRY_DAYS` | `2` | How long a voice `/v/` link stays usable |
| `RETENTION_DAYS` | `30` | Days after expiry before a session is purged |
| `START_CAP` | `5` | Max call starts per owner or voice link |
| `EXPERT_START_CAP` | `8` | Max starts per expert series token |

Expert cadence caps (soft / hard hang-up): weekly 10–15 / 15; biweekly 20–30 / 30; monthly 30–45 / 45.

## Pull before the shorter window

The host purges a session at link expiry + `RETENTION_DAYS`. Retell keeps its own copy. Pull before the shorter of those two windows.

## Attribution

Packaged for Semantic Mastery Mastermind by Bradley Benner.
