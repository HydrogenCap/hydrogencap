import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SHORTCUT_GROUPS } from './GlobalShortcuts';

export function ShortcutsCheatSheet() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('shortcuts:open', onOpen);
    return () => window.removeEventListener('shortcuts:open', onOpen);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Move faster across the portfolio. Shortcuts are skipped while typing in form fields.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                {group.label}
              </h3>
              <ul className="divide-y divide-border border rounded-md">
                {group.items.map((item) => (
                  <li
                    key={item.description}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="text-foreground">{item.description}</span>
                    <span className="flex items-center gap-1">
                      {item.keys.map((k, i) => (
                        <kbd
                          key={`${k}-${i}`}
                          className="inline-flex min-w-[1.75rem] items-center justify-center rounded border bg-muted px-1.5 py-0.5 text-[11px] font-mono font-medium text-foreground shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
