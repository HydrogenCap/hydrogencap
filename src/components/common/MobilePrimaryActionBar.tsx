import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Mobile-only sticky bottom bar for the primary action button.
 * Includes safe-area-inset-bottom padding. Hidden at lg: and up.
 */
export function MobilePrimaryActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border',
        'px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
        '[&>*]:w-full',
        className,
      )}
    >
      {children}
    </div>
  );
}
