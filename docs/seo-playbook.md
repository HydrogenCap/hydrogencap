# SEO Playbook

How head tags, sitemap, and structured data fit together on this project. Read this before adding a new marketing route or guide.

## Architecture

- **Sitewide head** lives in `index.html`: charset, viewport, brand title fallback, default `og:*`, Twitter card, theme-color, `Organization` + `SoftwareApplication` JSON-LD.
- **Per-route head** is set via `react-helmet-async` through the `<SEO>` wrapper at `src/components/SEO.tsx`. Helmet replaces sitewide tags for JS-aware crawlers (Googlebot). Non-JS social crawlers (LinkedIn, Slack, Facebook) fall back to the static `index.html` head — that's why we keep a generic `og:image` and description there.
- **Canonical**: `<SEO>` always emits one. **Do not** add `<link rel="canonical">` to `index.html` — that would ship two canonicals.

## Adding a new marketing page

1. Add the route to `src/App.tsx` (under the marketing routes block).
2. Drop `<SEO ... />` at the top of the page component:
   ```tsx
   <SEO
     title="Page name — short hook"   // keep total title (+ " | TenureIQ") under 60 chars
     description="One sentence, 120–155 chars, action-oriented."
     jsonLd={breadcrumbList([
       { name: 'Home', path: '/' },
       { name: 'Page name', path: '/page' },
     ])}
   />
   ```
3. Add the route to `scripts/generate-sitemap.ts` `entries`.
4. Add a one-line entry to `public/llms.txt` under `## Pages`.

## Structured data helpers

All in `src/lib/seo/jsonLd.ts`:

- `breadcrumbList(items)` — every marketing page should ship this.
- `faqPage(entries)` — wherever there's a Q&A accordion. Used on `/pricing`.
- `productWithOffers(name, description, tiers)` — pricing pages with priced tiers. Generates an `AggregateOffer` Google can render in SERPs.
- `articleSchema({ headline, description, url, datePublished })` — for `/guides/*` (Phase 4).

Pass a single object or an array to `<SEO jsonLd={...} />`.

## Sitemap

- `scripts/generate-sitemap.ts` runs before `dev` and `build` (npm `predev` / `prebuild` hooks).
- Auto-stamps `<lastmod>` to today on every run, so a fresh build is always a fresh sitemap.
- App routes (Dashboard, Properties, etc.) are intentionally excluded — they require auth and are blocked in `public/robots.txt`.

## robots.txt

- Public marketing routes: `Allow: /`.
- App surface: explicit `Disallow:` per top-level path. Add a new line whenever you add a new authenticated top-level route.
- Sitemap directive points at the canonical production sitemap URL.

## Title & description checklist

- Title: under 60 chars including the " | TenureIQ" suffix the SEO component adds automatically. If your `title` prop already contains "Tenure IQ" the suffix is skipped.
- Description: 120–155 chars, written for humans, ends with a period.
- Canonical: leave `canonical` unset to use the current pathname (preferred). Override only when consolidating duplicates.
- `og:image`: leave unset to inherit the sitewide `/og-image.jpg`. Override only with a per-page image that's worth a separate render.

## Google Search Console

1. Connect via the Google Search Console connector (`standard_connectors--connect`, `connector_id: "google_search_console"`).
2. Run META verification on `https://tenureiq.com/` — the verification token must be added to `index.html` via a deploy.
3. Submit `https://tenureiq.com/sitemap.xml`.

## After scanner findings change

Re-run the SEO Review (Lovable SEO tab) after any meaningful change. The scanner reads the last published build, so republish before marking findings fixed.
