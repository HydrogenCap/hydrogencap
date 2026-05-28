import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// Gmail-style sequence navigation: press "g" then a destination key.
const NAV_MAP: Record<string, string> = {
  d: '/dashboard',
  p: '/properties',
  t: '/tenants',
  c: '/compliance',
  r: '/rent-reconciliation',
  l: '/lending',
  i: '/insights',
  e: '/entities',
  o: '/ownership',
  m: '/dashboard-map',
  j: '/jobs-works',
  n: '/inbox',
  s: '/settings',
};

const SEQUENCE_TIMEOUT_MS = 1200;

/**
 * App-wide keyboard shortcuts:
 *  - "/"              focuses [data-global-search]
 *  - "⌘K" / "Ctrl+K"  opens the command palette (handled by CommandPalette)
 *  - "?"              opens the shortcuts cheat sheet
 *  - "g" then a key   Gmail-style navigation (see NAV_MAP)
 *
 * All sequences are skipped while typing in an input/textarea/contenteditable.
 */
export function GlobalShortcuts() {
  const navigate = useNavigate();
  const gPressedAtRef = useRef<number | null>(null);

  useEffect(() => {
    const isEditable = (el: EventTarget | null): boolean => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.altKey) return;

      // ⌘K / Ctrl+K is handled inside CommandPalette to keep state local.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return;
      if (e.metaKey || e.ctrlKey) return;

      if (isEditable(e.target)) return;

      // "?" shortcut sheet (Shift+/ on most layouts).
      if (e.key === '?') {
        e.preventDefault();
        window.dispatchEvent(new Event('shortcuts:open'));
        return;
      }

      // "/" → focus global search.
      if (e.key === '/') {
        const target = document.querySelector<HTMLElement>('[data-global-search]');
        if (target) {
          e.preventDefault();
          target.focus();
          if (target instanceof HTMLInputElement) target.select();
        }
        return;
      }

      // Gmail-style "g <key>" sequence.
      const now = Date.now();
      const key = e.key.toLowerCase();

      if (gPressedAtRef.current && now - gPressedAtRef.current <= SEQUENCE_TIMEOUT_MS) {
        const dest = NAV_MAP[key];
        gPressedAtRef.current = null;
        if (dest) {
          e.preventDefault();
          navigate(dest);
        }
        return;
      }

      if (key === 'g') {
        gPressedAtRef.current = now;
      } else {
        gPressedAtRef.current = null;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  return null;
}

// eslint-disable-next-line react-refresh/only-export-components
export const SHORTCUT_GROUPS = [
  {
    label: 'Global',
    items: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['/'], description: 'Focus search' },
      { keys: ['?'], description: 'Show this shortcuts sheet' },
    ],
  },
  {
    label: 'Navigate (press G then…)',
    items: [
      { keys: ['G', 'D'], description: 'Dashboard' },
      { keys: ['G', 'P'], description: 'Properties' },
      { keys: ['G', 'T'], description: 'Tenants' },
      { keys: ['G', 'C'], description: 'Compliance' },
      { keys: ['G', 'R'], description: 'Rent reconciliation' },
      { keys: ['G', 'L'], description: 'Lending' },
      { keys: ['G', 'I'], description: 'Insights' },
      { keys: ['G', 'E'], description: 'Legal entities' },
      { keys: ['G', 'M'], description: 'Portfolio map' },
      { keys: ['G', 'J'], description: 'Jobs & works orders' },
      { keys: ['G', 'N'], description: 'Inbox' },
      { keys: ['G', 'S'], description: 'Settings' },
    ],
  },
];
