# SEO & Marketing Site — Full Epic

## Current state (audit)

**Working today**
- Sitewide head in `index.html`: title, description, canonical, og:*, Twitter, Organization + SoftwareApplication JSON-LD, theme-color, OG image (`/og-image.jpg`).
- `public/robots.txt` blocks the app surface (`/auth`, `/dashboard` not listed but `/onboarding`, `/tenant-portal`, `/investor`, `/admin` are).
- `public/sitemap.xml` static, 13 marketing URLs, lastmod `2026-04-29` (stale).
- `src/components/SEO.tsx` mutates `document.head` directly. Used on 30+ pages. Works for Googlebot, **invisible to social-preview crawlers** (LinkedIn/Slack/Facebook don't run JS).
- 10 marketing routes: `/`, `/product`, `/pricing`, `/portfolio`, `/case-studies`, `/security`, `/about`, `/contact`, `/demo`, `/book-a-demo` + 3 legal.

**Scanner gaps**
1. Home `<title>` >60 chars (truncated in SERPs).
2. `Pricing.tsx` has a FAQ section but no `FAQPage` JSON-LD.
3. Google Search Console not connected → no impression/click data, no sitemap submission.
4. Sitemap flagged for missing `/auth`, `/dashboard`, `/dashboard/map` — **false positive**, these are private. The real fix is making sure `robots.txt` explicitly disallows them.
5. `/llms.txt` missing.
6. Lighthouse low-contrast text (likely `muted-foreground` on muted backgrounds in marketing footer/captions).

**Structural gaps not in the scan**
- No `react-helmet-async` → social cards fall back to sitewide OG on every route.
- No per-route canonical that survives social crawlers.
- No Breadcrumb JSON-LD (rich snippets miss).
- `og-image.jpg` exists but never audited for the 1200×630 spec.
- No content surface (blog/guides) to win long-tail UK landlord queries — the most reliable SaaS organic-growth lever.

---

## Goals

1. Make every public route ship a correct, social-crawler-visible head.
2. Close every scanner finding cleanly.
3. Stand up an evergreen content surface (Guides) so the site can rank for "EICR renewal", "HMO licence rules", "Section 21 abolition", etc.
4. Wire Google Search Console so future SEO work is data-driven.

---

## Phases

### Phase 1 — Foundations (small)

- Install `react-helmet-async`, wrap `<HelmetProvider>` in `src/main.tsx` once.
- Replace `src/components/SEO.tsx` internals with `Helmet` (keep the same prop API → zero call-site churn). Add optional `jsonLd?: object | object[]` and `noindex?: boolean` props.
- **Remove** the single `<link rel="canonical">` from `index.html` to prevent duplicate canonicals on JS-aware crawlers. Leave sitewide og:* as fallback.
- Tighten Home title to ≤60 chars (e.g. `"Tenure IQ — UK Property Portfolio Management"`).
- Add explicit `Disallow: /dashboard` and `Disallow: /properties` (+ other app routes) to `robots.txt` so the scanner stops flagging them; mark that finding fixed.
- Migrate `public/sitemap.xml` (static, stale dates) → `scripts/generate-sitemap.ts` invoked from `predev` + `prebuild`. Auto-stamp `lastmod` to today. Source the route list from a single constant shared with the marketing nav.

### Phase 2 — Structured data + per-route polish (medium)

- Add `FAQPage` JSON-LD to `Pricing.tsx` (use existing `faqs` array).
- Add `BreadcrumbList` JSON-LD helper, drop into every marketing page via the new `SEO` component's `jsonLd` prop.
- Add `Product` schema with `AggregateOffer` to `Pricing.tsx` (Starter/Growth/Pro tiers) — Google can render price ranges in SERPs.
- Add `Article` schema scaffolding to `CaseStudies.tsx` entries.
- Audit `/og-image.jpg`: verify 1200×630, regenerate via `imagegen` if needed with the Navy/Gold brand and tagline.
- Per-route og:image override for: Pricing (price-callout image), Case Studies (per-study image), Security (badge collage).
- Fix Lighthouse contrast: replace any `text-muted-foreground/50` or `text-gray-300/400` in marketing components with `text-muted-foreground` or `text-foreground`.

### Phase 3 — Discoverability infra (small)

- Create `public/llms.txt` with H1, 1-line summary, and a curated link list (marketing + guides only, never app routes). Generated from the same sitemap entry list.
- Connect Google Search Console via the connector flow, run META verification on `https://tenureiq.com/`, submit `https://tenureiq.com/sitemap.xml`.
- Add `<link rel="alternate" hreflang="en-GB" />` self-reference (we're UK-only — locks the right SERP locale).
- Add `WebSite` JSON-LD with `SearchAction` to `index.html` so Google can offer a Sitelinks search box.

### Phase 4 — Content surface (large, biggest organic lever)

A small `/guides` section is where the actual organic compounding happens. UK landlord queries are high-intent and competitively soft compared to US SaaS.

- New route `/guides` (index) + `/guides/:slug` (article) under `MarketingLayout`.
- Author 6 launch guides aimed at high-intent landlord queries (use Semrush to confirm volume/difficulty before writing — short list below).
- MDX-style: keep articles as TS files under `src/content/guides/*.tsx` (no CMS, no backend). Each carries Helmet + Article + Breadcrumb JSON-LD.
- Each guide ends with a contextual CTA to the matching product feature (e.g. EICR guide → Compliance module).
- Extend the sitemap generator to enumerate guide slugs automatically.

**Launch guide shortlist** (validate with Semrush before writing):
- HMO licence renewal — process & timeline
- EICR for landlords — 2026 rules
- Section 21 abolition — what changes for landlords
- Gas Safety certificate — landlord obligations
- EPC band C deadline — what's still required
- Right to Rent checks — 2026 process

### Phase 5 — Measurement & ongoing (small)

- Add a one-pager `docs/seo-playbook.md` with: how to add a new marketing page (Helmet checklist), how to add a guide, where canonicals live, the route → sitemap pipeline.
- Set a `lastmod` policy: auto-stamp from file mtime in the generator so each edit refreshes the sitemap entry.
- After publishing, re-run the SEO Review; mark remaining findings fixed.

---

## STOP-and-ask checkpoints

- **Before Phase 4:** confirm content tone/voice and whether guides should be authored by you / a copywriter / AI-drafted-then-edited. The shortlist also needs your sign-off (or replacement) based on the lead funnel.
- **GSC connection (Phase 3):** requires you to authorize the Google OAuth flow inline — I can't do that headless.
- **OG image regeneration (Phase 2):** I'll only spend the imagegen call if you want it; otherwise the current asset stays.

---

## Out of scope (intentional)

- SSR / prerendering. Helmet handles JS-aware crawlers; current social-card fallback in `index.html` is acceptable until the lead volume justifies the build complexity.
- Translating the site. UK-only stays UK-only.
- Migrating off the static sitemap to dynamic DB-driven entries (no public dynamic content yet — guides are file-backed).
- Touching app-internal routes (Dashboard, Properties, etc.) — they're correctly `noindex` via robots.

---

## Technical notes

- `react-helmet-async` is React-19-compatible (peer warning only).
- The existing `SEO` component API stays the same to avoid touching 30+ call sites; only its internals change.
- Sitemap generator runs in Node via `tsx` — no Vite plugin needed, matches the project's existing script pattern (`scripts/check-edge-functions.mjs`, etc.).
- All JSON-LD goes through a small helper (`src/lib/seo/jsonLd.ts`) that stringifies safely.

---

## Sequencing & sizing

| Phase | Size | Blocks others |
|---|---|---|
| 1 Foundations | S (~2h) | Yes — Phase 2 depends on Helmet |
| 2 Structured data | M (~4h) | No |
| 3 Discoverability | S (~1h) + GSC auth | No |
| 4 Content surface | L (~1–2 days incl. drafting) | No — can ship after 1–3 |
| 5 Playbook | S (~30m) | No |

Recommend shipping 1+2+3 as the first PR (one preview, one scanner re-run), then 4 as a follow-up once the launch guide list is agreed.