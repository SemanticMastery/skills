# SiteSwarm tags from topic clusters

After `02-plan/editorial-roadmap.md` exists, create the campaign **SiteSwarm tag taxonomy**. Tags are condensed cluster names. Overlapping clusters share one tag.

This is an **init companion** (after resources, after the roadmap), not a produce stage and not CMS publish. SiteSwarm MCP has no `create_tag` tool. Tags become live on first `create_post.tag_list`. This file is the allowlist that `content-pipeline-photo-library` classify/HITL and later publish / `3.5-images` matching must use.

Do **not** seed dummy draft posts just to register tags.

## When

Run immediately after the roadmap is written or reused, **before** `init_complete` and **before** photo-library ingest/classify.

| Roadmap | Taxonomy | Action |
|---------|----------|--------|
| Missing | — | Do not invent tags. Finish `02-plan` first. |
| Present | Missing | Create taxonomy now. |
| Present | Present | Reuse. Rebuild only if the operator asks or the Cluster set changed. |

Missing SiteSwarm site (Danville-style) is **not** a hard-stop. Still write the file.

## Paths

| Role | Path |
|------|------|
| **Write SoT** | `{pipeline_dir}/02-plan/siteswarm-tag-taxonomy.md` |
| **Reuse / sync** | `{pipeline_dir}/04-publish/siteswarm-tag-taxonomy.md` if that file already exists |

Do not create `04-publish/` to hold this file. If a copy is already there, update it so it does not drift from `02-plan/`.

Record the SoT path on the **init** manifest `plan.siteswarm_taxonomy` field.

## Procedure

1. Extract unique `Cluster` values:

```bash
node scripts/extract-roadmap-clusters.mjs --campaign-dir "..."
```

2. Search the same **Agency** folder (`{campaign_dir}/..`) for other `siteswarm-tag-taxonomy.md` files. If a sibling in the same vertical already has a live allowlist, **reuse those topic strings** and remap this campaign's clusters onto them. Summit Tree Service uses the Ridgeline Tree Care topic tags (not a second invented set). Drop geo tags that do not apply here.
3. If no sibling allowlist: map clusters with the rules below. Prefer fewer tags than clusters.
4. Optionally `list_sites` on SiteSwarm. If a matching `* Blog` (or the campaign site) exists, note `site_id` + name on the taxonomy. If none, write `site_id: none yet`.
5. Write `02-plan/siteswarm-tag-taxonomy.md` in the output format below. Sync an existing `04-publish/` copy.
6. Record the path on the init manifest. Then finish init (`init_complete` only when roadmap + taxonomy exist) and suggest **content-pipeline-photo-library**.

## Mapping rules

House style from Cedar Ridge Music, Ridgeline Tree Care, and Summit Tree Service.

### Form

| Rule | Do | Don't |
|------|----|-------|
| Length | 1–2 words typical; 3 only when needed (`Custom Guitars`, `Summit County`) | Paste the full cluster sentence |
| Case | Title Case exact strings | kebab-case, ALL CAPS, `#hashtags` |
| Shape | Noun-first service / product / topic | Gerunds, "and", audience tails (`Beginners and parents`) |
| Count | Usually **1** tag per post (primary). Optional geo as a second tag | One unique tag per cluster (1:1) |

Aim for about **half to three-quarters** as many topic tags as unique clusters. Never 1:1.

### Consolidate overlap

Merge clusters that are the same offer, a subset of the same job, or an audience split of the same service:

- Same line of work → one tag (`Tree Health & Inspection` + `Arborist Services` + `Fertilization & Maintenance` → `Tree Care`)
- Audience split of the same offer → one tag (`Lessons and teachers` + `Beginners and parents` → `Lessons`)
- Adjacent / subset service → parent tag (`Stump & Cleanup` → `Tree Removal`)
- NAP / ops / meta clusters → the destination / brand-home tag (`Hours, financing, and shipping` + `Strings, reviews, and events` + `Metro Area destination shop` → `Guitar Store`)
- `Local Authority — {place}` → the **umbrella service** tag (`Tree Care`), **not** a city-named tag

### Keep distinct

Keep a separate tag when the cluster is a shoppable or bookable category of its own:

- Service verbs that customers book separately (`Tree Removal` vs `Tree Pruning` vs `Land Clearing` vs `Emergencies`)
- Product classes a shop would filter (`Guitar Types` vs `Used Guitars` vs `Custom Guitars` vs `Guitar Repairs` vs `Guitar Rentals` vs `Guitar Accessories`)
- A named specialty that is not generic care (`Oak Wilt Care` → `Tree Diseases`, not `Tree Care`)

An allowlist may include a **likely unused** sibling tag (`Tree Pests`) when the vertical already uses that closed set. Do not invent a long speculative list.

### Geo tags (optional, conservative)

- Add a geo tag only when it is a real admin unit already used as a tag — house style is `* County` (`Summit County`, `Valley County`).
- Do **not** invent city tags (`Fairview`, `Lakeside`, `Harborview`). Independent cities stay caption-only until the operator adds a convention.
- `Local Authority` rows: primary = umbrella service; geo = county only if that county is on the allowlist.

### Image-library note

`content-pipeline-photo-library` classifies against this allowlist. `3.5-images` later matches `approved/` photos with a **primary topic tag** and an optional county bonus. Do not invent a second tag vocabulary for images.

## Worked examples (calibration)

### Ridgeline Tree Care — 13 clusters → 8 topic + 2 county

| Roadmap cluster | Primary tag | Geo (when place-specific) |
|-----------------|-------------|---------------------------|
| Hazard & Emergency | Emergencies | per city → county |
| Tree Health & Inspection | Tree Care | optional |
| Trimming & Pruning | Tree Pruning | optional |
| Tree Removal | Tree Removal | optional |
| Stump & Cleanup | Tree Removal | optional |
| Oak Wilt Care | Tree Diseases | optional |
| Arborist Services | Tree Care | optional |
| Fertilization & Maintenance | Tree Care | optional |
| Land Clearing | Land Clearing | optional |
| Seasonal Authority | Seasonal Prep | optional |
| Local Authority — Fairview | Tree Care | Summit County |
| Local Authority — Brookfield / Millbrook | Tree Care | Summit County |
| Local Authority — Clearwater / North Metro | Tree Care | Summit County; Valley County when North Metro is in scope |

Allowlist extras: `Tree Pests` (closed vertical set). Geo: `Summit County`, `Valley County`.

### Summit Tree Service — same topic tags as Ridgeline

Reuse Ridgeline topic strings exactly. Do not invent a parallel vocabulary.

No `* County` tags: Lakeside, Harborview, Eastport, Bayside are independent cities. `Local Authority — Lakeside` / `Harborview` → `Tree Care` only. `Stump & Cleanup` still → `Tree Removal`.

### Cedar Ridge Music — 11 clusters → 8 topic, no geo

| Roadmap cluster | Primary tag |
|-----------------|-------------|
| Metro Area destination shop | Guitar Store |
| Boutique and custom inventory | Custom Guitars |
| Electric, acoustic, and bass | Guitar Types |
| Used, vintage, and trade-in | Used Guitars |
| Pedals, amps, and accessories | Guitar Accessories |
| Lessons and teachers | Lessons |
| Beginners and parents | Lessons |
| Repair, setup, and luthier | Guitar Repairs |
| School rentals | Guitar Rentals |
| Hours, financing, and shipping | Guitar Store |
| Strings, reviews, and events | Guitar Store |

Usually **1 tag**. No city/region tags.

## Output format

```markdown
# SiteSwarm tag taxonomy — {Campaign Name}

Canonical allowlist for `create_post.tag_list` (comma-separated). SiteSwarm MCP has no categories yet; tags are the cluster proxy.

Exact strings only. Do not invent tags. Title Case.

## Allowlist

| Tag | Use for |
|-----|---------|
| Example Tag | When to apply it |

## Cluster → tag mapping

Map `editorial-roadmap.md` **Cluster** to one primary topic tag. Add a geo tag only when the post is place-specific and that geo tag is on the allowlist.

| Roadmap cluster | Primary tag | Geo tag (when place-specific) |
|-----------------|-------------|-------------------------------|
| Example Cluster | Example Tag | — |

### City → geo quick ref

No geo tags on this campaign.

## Agent rules

1. Prefer tags from this allowlist only; do not invent new tags without updating this file.
2. Usually **1 tag** (primary topic). Add a geo tag only when the title/slug is place-specific and a geo tag exists on the allowlist.
3. Pass as comma-separated string, e.g. `Tree Care, Summit County`.
4. When SiteSwarm adds real categories, revisit whether topic tags stay as tags or move to categories.

## SiteSwarm site

- site_id: none yet
- site name: —
- Tags go live on first `create_post` with `tag_list`. Do not seed dummy posts.
```

Every unique roadmap cluster must appear in the mapping table. Every primary/geo value must appear in the Allowlist.

## Agent rules (runtime)

1. Prefer this file's allowlist only after it exists.
2. Usually 1–2 tags: primary topic + geo when place-specific and allowlisted.
3. Pass `create_post.tag_list` as a comma-separated string (`Emergencies, Summit County`).
4. Sibling same-vertical campaigns share topic strings.
