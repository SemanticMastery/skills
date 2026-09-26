# Logo / image / geo intake (Step 0c)

Run **after** Step 0b (`sameAs` intake) succeeds and **before** silo detection / JSON-LD generation whenever the run includes a **`LocalBusiness`** (or subtype) or homepage **`Corporation` + `LocalBusiness`** `@graph`.

## What does **not** skip Step 0c

These are **not** permission to omit `logo`, `image`, or `geo`, and they do **not** skip this gate:

- “Proceed”, “continue”, “looks good”, “go ahead”
- “Generate schema” / “generate JSON-LD”
- “Dossier is done” / “dossier is ready” / “dossier landed”
- Completing Step 0 or Step 0b
- A current `*Dossier.md` existing on disk

If Step 0c was asked earlier in **this session** and the user never answered with one of the three qualifying answers below, **ask the mandatory prompt again and stop**. Do not write `LocalBusiness` / `Corporation` JSON-LD.

After a dossier lands **mid-thread**, **re-run Step 0c** (or explicitly confirm the prior qualifying answer) before JSON-LD. Do **not** infer omit from the dossier existing.

## Skip Step 0c only when

**Exactly one** of these is true:

1. The task is **non-local** schema only (FAQ, Article, Product, HowTo on pages with no NAP entity).
2. The user **pasted** a logo URL, primary image URL, and/or lat/long for this client in the initiating message or earlier in **this session**.
3. The user said **"extract from GBP/site"** in this session for this client.
4. The user said **"omit media and geo"** in this session for this client.

No other phrasing qualifies. Partial paste applies only the fields they gave; unspecified fields stay omitted unless they also said extract.

**Do not** invent coordinates, logo URLs, or photo URLs. **Do not** silently scrape and inject them without the user choosing **"extract from GBP/site"** (or pasting values).

---

## Ask once (mandatory prompt)

Use this wording (do not paraphrase):

> Before I generate Local Business / Corporation schema, do you want to provide a **logo URL**, **primary business photo/image URL**, and/or **geo coordinates** for the physical address?
>
> If yes, paste whatever you have (absolute `https://` URLs; lat/long as decimal degrees):
> - Logo URL
> - Primary image / photo URL (storefront, team, or GBP primary photo)
> - Latitude and longitude for the verified street address
>
> If you want me to pull what I can from the **confirmed GBP place** and/or **official website** (without you pasting values), say **"extract from GBP/site"**.
>
> If you prefer to ship without these fields for now, say **"omit media and geo"** — I will leave `logo`, `image`, and `geo` out of the homepage graph (you can add them later before deploy).

**Do not** generate homepage or site-wide `LocalBusiness` / `Corporation` graphs until the user gives a qualifying answer (paste / **"extract from GBP/site"** / **"omit media and geo"**).

When Steps **0b** and **0c** are both still outstanding, you may ask both mandatory prompts in the **same** assistant turn — still **stop** until each has a clear qualifying answer. Do not start Steps 1–5 early.

---

## Accepted answers

| User says | Agent action |
|-----------|--------------|
| Pastes logo and/or image URL(s) and/or lat/long | Use verified values; omit any field they did not provide |
| **"extract from GBP/site"** | Only then resolve from confirmed GBP place details and/or official site assets already in scope (dossier + confirmed `gbp_url` + site). Never guess brand search results. |
| **"omit media and geo"** | Omit `logo`, `image`, and `geo` from homepage nodes; note omission in implementation handoff |
| Partial paste (e.g. logo only) | Apply what they gave; treat unspecified fields as omit unless they also said extract |
| “Proceed” / “generate schema” / “dossier is ready” | **Not** a qualifying answer — ask Step 0c again and **stop** |

---

## Where to apply

| Property | Node | Notes |
|----------|------|-------|
| `logo` | `Corporation` (`#corporation`) | Prefer `ImageObject` with absolute `url`. Do not invent dimensions. |
| `image` | `LocalBusiness` subtype | Primary business photo; absolute `https://` URL or `ImageObject`. May `@id`-ref the logo `ImageObject` when the user supplied one asset for both. |
| `geo` | `LocalBusiness` subtype | `"@type": "GeoCoordinates"` with `latitude` + `longitude` for the **verified street address** only |
| `hasMap` | `LocalBusiness` subtype | **Must** be `https://www.google.com/maps?cid={CID}`. Independent of Step 0c omit. Resolve share / maps.app / place URLs first (`scripts/resolve-maps-cid.mjs`). Do **not** ship `maps.app.goo.gl` or `share.google` as `hasMap`. If CID cannot be resolved, **stop and ask**. |

**Do not** put `geo` on `Corporation` unless the user explicitly requests it. **Do not** put placeholder `"latitude": "[latitude]"` strings in client deliverables — omit the property instead.

Document final logo / image / geo values (or explicit omit) in `homepage-implementation.md`.

---

## Quick decision flow

```text
LocalBusiness / Corporation in scope?
  → no → skip Step 0c
  → yes → Step 0b already satisfied?
        → no → finish Step 0b first (may ask 0b+0c together)
        → yes → qualifying 0c answer this session
                (paste / "extract from GBP/site" / "omit media and geo")?
              → no → ASK mandatory prompt (again if unanswered) → STOP
              → yes → apply table
                    → dossier landed mid-thread since that answer?
                      → yes → re-ask or confirm prior qualifying answer → STOP until confirmed
                      → no → Steps 1–5
```
