# sameAs intake (Step 0b)

Run **after** dossier preflight (Step 0) succeeds and **before** silo detection / JSON-LD generation whenever the run includes a **`LocalBusiness`** (or subtype) or homepage **`Corporation` + `LocalBusiness`** `@graph`.

**Skip Step 0b** when:

- The user already supplied a `sameAs` URL list in the same request (paste, bullet list, or workbook path).
- A prior message in **this session** already confirmed the authoritative `sameAs` set for this client.
- The task is **non-local** schema only (FAQ, Article, Product, HowTo on pages with no NAP entity).

---

## Ask once (mandatory prompt)

Use this wording (do not paraphrase):

> Do you have a list of URLs to reference in the **`sameAs`** attributes of the Local Business schema (and matching **`Corporation`** node on the homepage)?
>
> If yes, paste every profile or canonical URL you want included — for example: official website, Google Maps / GBP share link, Facebook, LinkedIn, Yelp, BBB, ID page, industry directories, and any other verified listings.
>
> If you do not have a list ready, say **"use dossier only"** and I will build `sameAs` from the business dossier `[V] DIGITAL ECOSYSTEM` plus any URLs you already specified (such as a dedicated ID page `@id`). You can add more URLs later before deploy.

**Do not** generate homepage or site-wide `LocalBusiness` / `Corporation` graphs until the user answers this question **or** has clearly provided an equivalent list in the initiating message.

---

## What to collect

| Source | Examples |
|--------|----------|
| User paste | Any HTTPS profile, directory, or entity URI they name |
| Dossier `[V]` | Website, Facebook, LinkedIn, etc. from verified dossier table |
| Prior session inputs | Dedicated ID page URL, GBP Maps share link, Wayfront/listing exports |
| **Never auto-add** | URLs guessed from brand search, unverified SerpAPI picks, competitor profiles |

Ask the user to use **absolute `https://` URLs** only. Normalize duplicates; strip tracking query params when safe (`utm_*`, `fbclid`).

---

## Merge priority (authoritative `sameAs` array)

1. **User-provided list** (Step 0b answer or initiating message) — wins on conflict.
2. **Dossier `[V] DIGITAL ECOSYSTEM`** — fill gaps the user did not exclude.
3. **Required entity links** the user already mandated elsewhere in the session (e.g. ID page `https://…/id.html` when used as `LocalBusiness` `@id` — include in `sameAs` on both `LocalBusiness` and `Corporation` unless the user says omit).
4. **Official website** — include once (`https://woodlawntrees.com/` style canonical).

**Omit** from `sameAs`:

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
