import { useEffect } from 'react';

/**
 * App-wide keyboard shortcuts:
 *  - "/" focuses the first element marked with [data-global-search]
 *    (skipped when the user is typing in an input/textarea/contenteditable).
 *
 * Mount once near the router root.
 */
export function GlobalShortcuts() {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      if (e.key === '/') {
        const target = document.querySelector<HTMLElement>('[data-global-search]');
        if (target) {
          e.preventDefault();
          target.focus();
          if (target instanceof HTMLInputElement) target.select();
        }
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return null;
}
