import { useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mobile-only sticky bottom bar that opens a vaul drawer containing
 * secondary side-rail content (Actions, Financials, KPIs, etc.).
 *
 * Hidden at lg: breakpoint. Includes safe-area-inset-bottom padding.
 * Use a single `triggerLabel` to act as the primary CTA on mobile
 * (e.g. "Details & Actions"). The drawer panel scrolls internally.
 */
export function MobileDetailsSheet({
  title = 'Details',
  triggerLabel = 'Details & Actions',
  children,
  className,
}: {
  title?: string;
  triggerLabel?: string;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <div
        className={cn(
          'lg:hidden fixed bottom-0 inset-x-0 z-30 bg-background/95 backdrop-blur border-t border-border',
          'px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]',
          className,
        )}
      >
        <DrawerTrigger asChild>
          <Button size="lg" className="w-full gap-2" aria-label={`Open ${title.toLowerCase()} panel`}>
            <ChevronUp className="h-4 w-4" />
            {triggerLabel}
          </Button>
        </DrawerTrigger>
      </div>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-4">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
