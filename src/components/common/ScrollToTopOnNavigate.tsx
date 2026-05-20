import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets window scroll to top whenever the pathname changes.
 * Preserves hash navigation (e.g. /page#section) and back/forward state.
 */
export function ScrollToTopOnNavigate() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (hash) return; // let browser handle anchor jumps
    // Use auto to avoid jarring smooth-scroll on every route change
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname, hash, key]);

  return null;
}
