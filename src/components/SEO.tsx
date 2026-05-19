import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  /** Set to true for app routes/utility pages that should not be indexed. */
  noindex?: boolean;
  /** JSON-LD payload(s). Pass a single object or an array. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

const SITE = 'https://tenureiq.com';

/**
 * Per-route head tags powered by react-helmet-async.
 *
 * - title is wrapped with " | TenureIQ" unless it already mentions the brand.
 * - canonical defaults to SITE + current pathname.
 * - jsonLd accepts one or many schema.org objects (Article, FAQPage, etc.).
 *
 * The sitewide og:* defaults stay in index.html so non-JS social crawlers
 * still see a valid card; Helmet replaces them per-route for JS crawlers.
 */
export function SEO({ title, description, canonical, ogImage, noindex, jsonLd }: SEOProps) {
  const location = useLocation();
  const fullTitle = /tenure\s*iq/i.test(title) ? title : `${title} | TenureIQ`;
  const url = canonical || `${SITE}${location.pathname}`;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex ? <meta name="robots" content="noindex,nofollow" /> : null}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      {ogImage ? <meta property="og:image" content={ogImage} /> : null}

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage ? <meta name="twitter:image" content={ogImage} /> : null}

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(schema)}</script>
      ))}
    </Helmet>
  );
}
