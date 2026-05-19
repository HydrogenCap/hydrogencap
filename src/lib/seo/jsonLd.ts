/**
 * Schema.org JSON-LD builders for marketing routes.
 * Keep payloads pure data — no JSX, no DOM. The <SEO> component
 * stringifies them into <script type="application/ld+json"> tags.
 */

const SITE = 'https://tenureiq.com';

export interface BreadcrumbItem {
  name: string;
  /** Path beginning with "/" — SITE is prepended. */
  path: string;
}

export function breadcrumbList(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: `${SITE}${item.path}`,
    })),
  };
}

export interface FaqEntry {
  q: string;
  a: string;
}

export function faqPage(entries: FaqEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: entries.map((e) => ({
      '@type': 'Question',
      name: e.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: e.a,
      },
    })),
  };
}

export interface PricingTier {
  name: string;
  /** Numeric price in GBP. Use undefined for "Custom". */
  priceGbp?: number;
  description: string;
}

export function productWithOffers(name: string, description: string, tiers: PricingTier[]) {
  const priced = tiers.filter((t) => typeof t.priceGbp === 'number') as Required<PricingTier>[];
  const offers =
    priced.length > 0
      ? {
          '@type': 'AggregateOffer',
          priceCurrency: 'GBP',
          lowPrice: Math.min(...priced.map((t) => t.priceGbp)).toString(),
          highPrice: Math.max(...priced.map((t) => t.priceGbp)).toString(),
          offerCount: tiers.length.toString(),
          offers: priced.map((t) => ({
            '@type': 'Offer',
            name: t.name,
            price: t.priceGbp.toString(),
            priceCurrency: 'GBP',
            category: 'Subscription',
            availability: 'https://schema.org/InStock',
          })),
        }
      : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
    description,
    brand: { '@type': 'Brand', name: 'Tenure IQ' },
    ...(offers ? { offers } : {}),
  };
}

export function articleSchema(opts: {
  headline: string;
  description: string;
  url: string;
  datePublished?: string;
  author?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: opts.headline,
    description: opts.description,
    url: opts.url,
    ...(opts.datePublished ? { datePublished: opts.datePublished } : {}),
    author: {
      '@type': 'Organization',
      name: opts.author ?? 'Tenure IQ',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Tenure IQ',
      logo: { '@type': 'ImageObject', url: `${SITE}/og-image.jpg` },
    },
  };
}
