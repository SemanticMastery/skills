# Polish output (two zones, Markdown + HTML)

Polish is paste-ready for a page builder with **two content areas**. SiteSwarm is the first consumer. The same split works for other builders.

Do **not** emit a full HTML document (`html`, `head`, `body`). Each HTML block is an `<article>` body only.

Do **not** push SiteSwarm (or any CMS) unless the operator asks after polish.

## Zones

| Zone | Builder slot | What goes here |
|------|----------------|----------------|
| **Top of page** | Top-of-page content area | Main page copy: H1, service sections, CTAs, internal links. **No FAQs.** |
| **Bottom of page** | Bottom-of-page content area | Frequently asked questions only. If FAQs were Omit, write `Omit. No FAQ block.` in both formats. |

## Both formats

For each zone, emit:

1. **Markdown** — for operators who paste into a Markdown-to-HTML converter (SiteSwarm).
2. **HTML** — standard article markup for operators who paste HTML. Put the HTML in a fenced `html` code block so it is easy to copy.

HTML rules:

- Wrap the zone in one `<article>…</article>`.
- Use `h1` (top zone only), `h2`, `h3`, `p`, `a`. No classes, no inline styles, no `html`/`head`/`body`.
- Convert Markdown links to `<a href="https://…">`.
- No `[IMAGE:`, no TL;DR, no authorship box, no em dash.

## Package order

1. Technical suite (SEO title, meta, slug, H1, links)
2. Top of page — Markdown, then HTML
3. Bottom of page — Markdown, then HTML
4. Image suggestions (types + library pointers only)
