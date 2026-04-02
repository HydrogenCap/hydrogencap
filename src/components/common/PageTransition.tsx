import type { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  return (
    <div className="animate-in fade-in-0 duration-200 motion-reduce:animate-none">
      {children}
    </div>
  );
}
