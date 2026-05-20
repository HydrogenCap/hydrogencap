import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export type RecentEntityType = 'property' | 'tenant' | 'entity' | 'job' | 'workorder' | 'investor' | 'capex';

export interface RecentEntity {
  type: RecentEntityType;
  id: string;
  label: string;
  url: string;
  visitedAt: number;
}

const STORAGE_KEY = 'tenureiq.recently_viewed.v1';
const MAX_ITEMS = 12;

function readStore(): RecentEntity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentEntity[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

function writeStore(items: RecentEntity[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    window.dispatchEvent(new Event('recently-viewed:changed'));
  } catch {
    /* ignore */
  }
}

export function recordRecentEntity(entity: Omit<RecentEntity, 'visitedAt'>) {
  const items = readStore().filter((i) => !(i.type === entity.type && i.id === entity.id));
  items.unshift({ ...entity, visitedAt: Date.now() });
  writeStore(items);
}

export function clearRecentEntities() {
  writeStore([]);
}

/** Subscribe to recently-viewed entities (cross-tab + same-tab updates). */
export function useRecentlyViewed(limit: number = MAX_ITEMS): RecentEntity[] {
  const [items, setItems] = useState<RecentEntity[]>(readStore);

  useEffect(() => {
    const refresh = () => setItems(readStore());
    window.addEventListener('recently-viewed:changed', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('recently-viewed:changed', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  return items.slice(0, limit);
}

/**
 * Best-effort route-based tracker. Drop near the router and it will infer
 * recent entities from the current pathname. Detail components can still
 * call recordRecentEntity directly to attach a richer label.
 */
const ROUTE_PATTERNS: Array<{ regex: RegExp; type: RecentEntityType; buildUrl: (id: string) => string }> = [
  { regex: /^\/properties-v2\/([^/]+)/, type: 'property', buildUrl: (id) => `/properties-v2/${id}` },
  { regex: /^\/properties\/([^/]+)/, type: 'property', buildUrl: (id) => `/properties/${id}` },
  { regex: /^\/tenants-v2\/([^/]+)/, type: 'tenant', buildUrl: (id) => `/tenants-v2/${id}` },
  { regex: /^\/tenants\/([^/]+)/, type: 'tenant', buildUrl: (id) => `/tenants/${id}` },
  { regex: /^\/entities\/([^/]+)/, type: 'entity', buildUrl: (id) => `/entities/${id}` },
  { regex: /^\/jobs\/([^/]+)/, type: 'job', buildUrl: (id) => `/jobs/${id}` },
  { regex: /^\/work-orders\/([^/]+)/, type: 'workorder', buildUrl: (id) => `/work-orders/${id}` },
  { regex: /^\/investors\/([^/]+)/, type: 'investor', buildUrl: (id) => `/investors/${id}` },
  { regex: /^\/capex\/([^/]+)/, type: 'capex', buildUrl: (id) => `/capex/${id}` },
];

export function RecentlyViewedTracker() {
  const { pathname } = useLocation();

  const track = useCallback((path: string) => {
    for (const { regex, type, buildUrl } of ROUTE_PATTERNS) {
      const match = path.match(regex);
      if (!match) continue;
      const id = match[1];
      if (!id || id === 'new') return;

      // Wait a tick so detail pages can set a richer document.title
      window.setTimeout(() => {
        const title = document.title.replace(/\s·\sTenure IQ$/i, '').trim();
        recordRecentEntity({
          type,
          id,
          label: title || `${type[0].toUpperCase()}${type.slice(1)}`,
          url: buildUrl(id),
        });
      }, 400);
      return;
    }
  }, []);

  useEffect(() => {
    track(pathname);
  }, [pathname, track]);

  return null;
}
