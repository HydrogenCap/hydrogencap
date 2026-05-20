import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'tenureiq.snoozed.v1';

type SnoozeMap = Record<string, number>; // key -> snooze-until epoch ms

function load(): SnoozeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SnoozeMap;
    // Garbage-collect expired entries
    const now = Date.now();
    let dirty = false;
    for (const k of Object.keys(parsed)) {
      if (parsed[k] <= now) { delete parsed[k]; dirty = true; }
    }
    if (dirty) localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return {};
  }
}

function save(map: SnoozeMap) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch { /* ignore */ }
}

/**
 * Lightweight client-side snooze for fix-it / today items.
 * Keys are caller-defined (e.g. `compliance:<id>`, `risk:<id>`).
 */
export function useSnoozedItems() {
  const [map, setMap] = useState<SnoozeMap>(() => load());

  // Refresh on focus so multi-tab snoozes sync
  useEffect(() => {
    const onFocus = () => setMap(load());
    window.addEventListener('focus', onFocus);
    window.addEventListener('storage', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('storage', onFocus);
    };
  }, []);

  const isSnoozed = useCallback(
    (key: string) => {
      const until = map[key];
      return typeof until === 'number' && until > Date.now();
    },
    [map],
  );

  const snooze = useCallback((key: string, days = 7) => {
    setMap((prev) => {
      const next = { ...prev, [key]: Date.now() + days * 86_400_000 };
      save(next);
      return next;
    });
  }, []);

  const unsnooze = useCallback((key: string) => {
    setMap((prev) => {
      const next = { ...prev };
      delete next[key];
      save(next);
      return next;
    });
  }, []);

  const snoozedCount = Object.values(map).filter((t) => t > Date.now()).length;

  return { isSnoozed, snooze, unsnooze, snoozedCount };
}
