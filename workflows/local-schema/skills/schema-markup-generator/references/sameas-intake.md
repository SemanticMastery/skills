# sameAs intake (Step 0b)

Run **after** dossier preflight (Step 0) succeeds and **before** silo detection / JSON-LD generation whenever the run includes a **`LocalBusiness`** (or subtype) or homepage **`Corporation` + `LocalBusiness`** `@graph`.

**Skip Step 0b** when:

- The user already supplied a `sameAs` URL list in the same request (paste, bullet list, or workbook path), **or** explicitly said **"use dossier only"** in this session for this client.
- A prior message in **this session** already confirmed the authoritative `sameAs` set for this client (user list or **"use dossier only"**).
- The task is **non-local** schema only (FAQ, Article, Product, HowTo on pages with no NAP entity).

**Hard rule:** A current dossier (including `[V] DIGITAL ECOSYSTEM`) is **not** permission to skip the ask. Always surface the mandatory prompt unless one of the skip bullets above is true. Never silently build `sameAs` from the dossier and proceed to JSON-LD.

---

## Ask once (mandatory prompt)

Use this wording (do not paraphrase):

> Do you have a list of URLs to reference in the **`sameAs`** attributes of the Local Business schema (and matching **`Corporation`** node on the homepage)?
>
> If yes, paste every **external** profile or identity URL you want included — for example: Google Maps / GBP share link, Facebook, LinkedIn, Yelp, BBB, Wikipedia/Wikidata, ID page, industry directories, and any other verified listings. (Do **not** include the official website here — that belongs on the schema **`url`** property only.)
>
> If you do not have a list ready, say **"use dossier only"** and I will build `sameAs` from the business dossier `[V] DIGITAL ECOSYSTEM` (external profiles only) plus any URLs you already specified (such as a dedicated ID page `@id`). You can add more URLs later before deploy.

**Do not** generate homepage or site-wide `LocalBusiness` / `Corporation` graphs until the user answers this question **or** has clearly provided an equivalent list (or **"use dossier only"**) in the initiating message / this session.

---

## What to collect

| Source | Examples |
|--------|----------|
| User paste | External HTTPS profiles, directories, GBP/Maps, ID page, Wikidata, etc. |
| Dossier `[V]` | Facebook, LinkedIn, Yelp, BBB, etc. from verified dossier table — **not** the official website row |
| Prior session inputs | Dedicated ID page URL, GBP Maps share link, Wayfront/listing exports |
| **Never auto-add** | Official website / homepage URL; URLs guessed from brand search; unverified SerpAPI picks; competitor profiles |

Ask the user to use **absolute `https://` URLs** only. Normalize duplicates; strip tracking query params when safe (`utm_*`, `fbclid`).

**Official website → `url` only:** Put the canonical site on `Corporation.url` and LocalBusiness `url`. **Do not** auto-add it to `sameAs` (redundant with `url`; no meaningful identity benefit). If the user pastes the homepage in their `sameAs` list anyway, drop it from `sameAs` and keep it on `url` only — note that normalization in the handoff.

---

## Merge priority (authoritative `sameAs` array)

1. **User-provided list** (Step 0b answer or initiating message) — wins on conflict; strip official website if present.
2. **Dossier `[V] DIGITAL ECOSYSTEM`** — fill gaps the user did not exclude; skip website/homepage rows.
3. **Required entity links** the user already mandated elsewhere in the session (e.g. ID page `https://…/id.html` when used as `LocalBusiness` `@id` — include in `sameAs` on both `LocalBusiness` and `Corporation` unless the user says omit).

**Omit** from `sameAs`:

- Official website / homepage URL (belongs on `url` only)
- Placeholder or example URLs
- Broken / redirect-only links the user did not verify
- The business `telephone:` or `mailto:` (not valid `sameAs`)

---

## Where to apply

| Node | `sameAs` |
|------|----------|
| `Corporation` (`#corporation`) | Full merged list (brand-level profiles) |
| `LocalBusiness` subtype (including external `@id` / ID page URI) | Same merged list unless the user requests a subset for the local node only |
| `Service` / `WebPage` | **Do not** duplicate full `sameAs` — `provider` / `mainEntity` → **same** `LocalBusiness` `@id` as homepage ([dedicated-id-uri.md](dedicated-id-uri.md)) |

Document the final URL list in the implementation handoff (`homepage-implementation.md` or per-page notes) so deploy and citation audits stay traceable.

---

## Quick decision flow

```text
LocalBusiness / Corporation in scope?
  → no → skip Step 0b
  → yes → user already gave sameAs list this session?
        → yes → merge per priority → Steps 1–5
        → no → ASK mandatory prompt → wait
              → user list / "use dossier only" → merge → Steps 1–5
```
