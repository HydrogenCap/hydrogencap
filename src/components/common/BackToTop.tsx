import { useEffect, useState, useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BackToTopProps {
  /** Pixels scrolled before the button appears. Default: 600 */
  threshold?: number;
}

/**
 * Floating "back to top" button that fades in after the user
 * scrolls past `threshold`. Hidden from print.
 */
export function BackToTop({ threshold = 600 }: BackToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > threshold);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  const onClick = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to top"
      title="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={cn(
        'fixed bottom-6 right-6 z-40 print:hidden',
        'h-10 w-10 inline-flex items-center justify-center rounded-full',
        'bg-primary text-primary-foreground shadow-lg',
        'transition-opacity duration-200 hover:opacity-90',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
    >
      <ArrowUp className="h-4 w-4" />
    </button>
  );
}
