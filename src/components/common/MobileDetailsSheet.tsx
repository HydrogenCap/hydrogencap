import { useState, type ReactNode } from 'react';
import { PanelRightOpen } from 'lucide-react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Mobile-only floating "Details" trigger that opens a vaul bottom sheet
 * containing secondary side-rail panels. Hidden at lg: breakpoint and up.
 */
export function MobileDetailsSheet({
  title = 'Details',
  triggerLabel = 'Details',
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
    <div className={cn('lg:hidden', className)}>
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          <Button
            size="lg"
            className="fixed bottom-20 right-4 z-40 rounded-full shadow-lg h-12 px-5 gap-2"
            aria-label={`Open ${title.toLowerCase()} panel`}
          >
            <PanelRightOpen className="h-4 w-4" />
            {triggerLabel}
          </Button>
        </DrawerTrigger>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div
            className="overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] space-y-4"
          >
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
