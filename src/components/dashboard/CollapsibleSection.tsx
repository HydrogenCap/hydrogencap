import React, { ReactNode, useEffect, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
  id: string;
  title?: string;
  subtitle?: string;
  defaultOpen?: boolean;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Render without title chrome — used for invisible wrappers that just persist visibility */
  hideHeader?: boolean;
}

const STORAGE_KEY = 'dashboard.sections.v1';

type State = Record<string, boolean>;

function readState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function writeState(state: State) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function CollapsibleSection({
  id,
  title,
  subtitle,
  defaultOpen = true,
  toolbar,
  children,
  className,
  hideHeader,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState<boolean>(() => {
    const s = readState();
    return s[id] !== undefined ? s[id] : defaultOpen;
  });

  useEffect(() => {
    const s = readState();
    s[id] = open;
    writeState(s);
  }, [id, open]);

  const toggle = useCallback(() => setOpen((o) => !o), []);

  if (hideHeader) {
    return open ? <div className={className}>{children}</div> : null;
  }

  return (
    <section className={cn('space-y-3', className)} aria-labelledby={`section-${id}`}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between gap-2 print:hidden">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={`section-body-${id}`}
            className="group flex items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1 -mx-1"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform',
                !open && '-rotate-90',
              )}
            />
            <div>
              <h2
                id={`section-${id}`}
                className="text-sm font-semibold text-foreground uppercase tracking-wider"
              >
                {title}
              </h2>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </button>
          {toolbar && <div className="flex items-center gap-2">{toolbar}</div>}
        </div>
      )}
      <div
        id={`section-body-${id}`}
        hidden={!open}
        className={cn(!open && 'hidden', 'print:!block')}
      >
        {children}
      </div>
    </section>
  );
}
