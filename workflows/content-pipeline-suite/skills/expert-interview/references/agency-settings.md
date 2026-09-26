# Agency Workspace settings

One Google login per agency per machine. Tokens never enter the repo or a synced folder.

## File

`{Agency}/agency-settings.json` — walk up one level from the campaign directory.

```json
{
  "agency_slug": "example-agency",
  "calendar_id": "primary",
  "inviter_email": "agency@example.com",
  "gws_config_dir": "C:\\Users\\you\\AppData\\Local\\gws\\example-agency"
}
```

## Config dir

Documented default: `%LOCALAPPDATA%\gws\{agency-slug}`.

`gws_config_dir` must sit outside OneDrive / SharePoint / any synced folder. A synced path exits `config_dir_synced`.

## Shared OAuth client

User env vars (never a `client_secret.json` in the agency dir):

- `GOOGLE_WORKSPACE_CLI_CLIENT_ID`
- `GOOGLE_WORKSPACE_CLI_CLIENT_SECRET`

The gws OAuth client **consent screen must be in Production**. Testing mode expires refresh tokens after 7 days.

Current Google Cloud Console path (2026-09): **APIs and Services → Audience**. Publishing status and user type (External / Internal) are on that page. The older **OAuth consent screen** item may be gone or renamed.

Missing client env vars exit `gws_client_unset` before any login command is printed.

On `invalid_grant`, print:

`gws auth login` with `GOOGLE_WORKSPACE_CLI_CONFIG_DIR` set to the agency config dir.

## Calendar

The skill prints a `gws calendar events insert … --dry-run` command on `--preview`. `--create` runs it only after the operator says yes. The invite comes from the agency Workspace account in these settings.
