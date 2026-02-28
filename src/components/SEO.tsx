import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface SEOProps {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
}

export function SEO({ title, description, canonical, ogImage }: SEOProps) {
  const location = useLocation();
  const fullTitle = title.includes('HydrogenCap') ? title : `${title} | HydrogenCap`;
  const url = canonical || `https://hydrogencap.com${location.pathname}`;

  useEffect(() => {
    document.title = fullTitle;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);

    setMetaProperty('og:title', fullTitle);
    setMetaProperty('og:description', description);
    setMetaProperty('og:url', url);
    if (ogImage) setMetaProperty('og:image', ogImage);

    setMetaProperty('twitter:title', fullTitle);
    setMetaProperty('twitter:description', description);

    return () => {
      document.title = 'HydrogenCap | Property Portfolio Management';
    };
  }, [fullTitle, description, url, ogImage]);

  return null;
}

function setMetaProperty(property: string, content: string) {
  let meta = document.querySelector(`meta[property="${property}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', property);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}