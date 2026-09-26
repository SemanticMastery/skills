# Seed rules

Commercial-intent Matrix seed (KTD5, R9).

## Base

- Crawl page (has a live URL): slug words (`tree-removal` → `tree removal`).
- Catalog-only offering (no live URL): offering name (`Land clearing` → `land clearing`).

## Append ` service`

Append ` service` unless the last token is already one of:

`service`, `services`, `treatment`, `response`, `plan`, `plans`

## Examples (locked)

| Input | Seed |
|-------|------|
| tree removal | tree removal service |
| stump grinding | stump grinding service |
| oak wilt treatment | oak wilt treatment |
| arborist services | arborist services |
| emergency service | emergency service |

`emergency storm response` (catalog name) last token is `response` → unchanged.

## HITL

Do not run Content Maxima until the operator confirms the seed table (`awaiting_seed_confirm`).
