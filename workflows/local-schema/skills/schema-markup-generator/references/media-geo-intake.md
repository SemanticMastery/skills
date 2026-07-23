# Logo / image / geo intake (Step 0c)

Run **after** Step 0b (`sameAs` intake) succeeds and **before** silo detection / JSON-LD generation whenever the run includes a **`LocalBusiness`** (or subtype) or homepage **`Corporation` + `LocalBusiness`** `@graph`.

**Skip Step 0c** when:

- The user already supplied logo URL, primary image URL, and/or lat/long (or an explicit omit / extract instruction) in the same request or earlier in **this session** for this client.
- The task is **non-local** schema only (FAQ, Article, Product, HowTo on pages with no NAP entity).

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

**Do not** generate homepage or site-wide `LocalBusiness` / `Corporation` graphs until the user answers this question **or** has clearly provided an equivalent answer in the initiating message / this session.

When Steps **0b** and **0c** are both still outstanding, you may ask both mandatory prompts in the **same** assistant turn — still **stop** until each has a clear answer. Do not start Steps 1–5 early.

---

## Accepted answers

| User says | Agent action |
|-----------|--------------|
| Pastes logo and/or image URL(s) and/or lat/long | Use verified values; omit any field they did not provide |
| **"extract from GBP/site"** | Only then resolve from confirmed GBP place details and/or official site assets already in scope (dossier + confirmed `gbp_url` + site). Never guess brand search results. |
| **"omit media and geo"** | Omit `logo`, `image`, and `geo` from homepage nodes; note omission in implementation handoff |
| Partial paste (e.g. logo only) | Apply what they gave; treat unspecified fields as omit unless they also said extract |

---

## Where to apply

| Property | Node | Notes |
|----------|------|-------|
| `logo` | `Corporation` (`#corporation`) | Prefer `ImageObject` with absolute `url`. Do not invent dimensions. |
| `image` | `LocalBusiness` subtype | Primary business photo; absolute `https://` URL or `ImageObject`. May `@id`-ref the logo `ImageObject` when the user supplied one asset for both. |
| `geo` | `LocalBusiness` subtype | `"@type": "GeoCoordinates"` with `latitude` + `longitude` for the **verified street address** only |
| `hasMap` | `LocalBusiness` subtype | May use confirmed GBP / Maps share URL when available (independent of Step 0c omit) |

**Do not** put `geo` on `Corporation` unless the user explicitly requests it. **Do not** put placeholder `"latitude": "[latitude]"` strings in client deliverables — omit the property instead.

Document final logo / image / geo values (or explicit omit) in `homepage-implementation.md`.

---

## Quick decision flow

```text
LocalBusiness / Corporation in scope?
  → no → skip Step 0c
  → yes → Step 0b already satisfied?
        → no → finish Step 0b first (may ask 0b+0c together)
        → yes → user already answered media/geo this session?
              → yes → apply table → Steps 1–5
              → no → ASK mandatory prompt → wait
                    → paste / "extract from GBP/site" / "omit media and geo"
                    → apply → Steps 1–5
```
