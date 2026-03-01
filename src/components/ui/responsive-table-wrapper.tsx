import { cn } from '@/lib/utils';

interface ResponsiveTableWrapperProps {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}

/**
 * Wraps a Table component with horizontal scroll on mobile.
 * Use: <ResponsiveTableWrapper><Table>...</Table></ResponsiveTableWrapper>
 */
export function ResponsiveTableWrapper({ children, minWidth = '600px', className }: ResponsiveTableWrapperProps) {
  return (
    <div className={cn('overflow-x-auto -mx-4 md:mx-0', className)}>
      <div style={{ minWidth }}>
        {children}
      </div>
    </div>
  );
}
