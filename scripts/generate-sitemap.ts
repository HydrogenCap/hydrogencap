// Runs before `vite dev` and `vite build` (predev/prebuild hooks).
// Writes public/sitemap.xml. Auto-stamps <lastmod> to today.
//
// Only public, indexable routes belong here. App routes (Dashboard,
// Properties, etc.) are blocked via public/robots.txt and stay out.

import { writeFileSync } from 'fs';
import { resolve } from 'path';

const BASE_URL = 'https://tenureiq.com';

interface SitemapEntry {
  path: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: string;
}

const today = new Date().toISOString().slice(0, 10);

const entries: SitemapEntry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/product', changefreq: 'monthly', priority: '0.9' },
  { path: '/pricing', changefreq: 'monthly', priority: '0.9' },
  { path: '/portfolio', changefreq: 'monthly', priority: '0.8' },
  { path: '/case-studies', changefreq: 'weekly', priority: '0.8' },
  { path: '/security', changefreq: 'monthly', priority: '0.7' },
  { path: '/about', changefreq: 'monthly', priority: '0.7' },
  { path: '/contact', changefreq: 'monthly', priority: '0.7' },
  { path: '/demo', changefreq: 'monthly', priority: '0.7' },
  { path: '/book-a-demo', changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.3' },
  { path: '/terms', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookies', changefreq: 'yearly', priority: '0.3' },
];

function generate(items: SitemapEntry[]) {
  const urls = items.map((e) =>
    [
      '  <url>',
      `    <loc>${BASE_URL}${e.path}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      '  </url>',
    ]
      .filter(Boolean)
      .join('\n'),
  );

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n');
}

writeFileSync(resolve('public/sitemap.xml'), generate(entries));
console.log(`sitemap.xml written (${entries.length} entries, lastmod=${today})`);
