import { useEffect } from 'react';

const SUFFIX = ' · Tenure IQ';

/**
 * Sets document.title to "<title> · Tenure IQ" while the component is mounted.
 * Restores the previous title on unmount.
 */
export function usePageTitle(title: string | undefined | null) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title}${SUFFIX}`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
