import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type EntityFilterKey =
  | 'all'
  | 'spv'
  | 'personal'
  | 'jv_trust'
  | 'group_parent'
  | 'stale_sync'
  | 'filings_overdue'
  | 'filings_due_soon'
  | 'dormant';

interface ChipDef {
  key: EntityFilterKey;
  label: string;
}

const CHIPS: ChipDef[] = [
  { key: 'all', label: 'All' },
  { key: 'spv', label: 'SPV' },
  { key: 'personal', label: 'Personal' },
  { key: 'jv_trust', label: 'JV / Trust' },
  { key: 'group_parent', label: 'Group parent' },
  { key: 'stale_sync', label: 'Stale sync' },
  { key: 'filings_overdue', label: 'Filings overdue' },
  { key: 'filings_due_soon', label: 'Filings ≤30d' },
  { key: 'dormant', label: 'Dormant' },
];

interface EntitiesFilterChipsProps {
  active: EntityFilterKey;
  onChange: (key: EntityFilterKey) => void;
  counts?: Partial<Record<EntityFilterKey, number>>;
}

export function EntitiesFilterChips({ active, onChange, counts }: EntitiesFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => {
        const isActive = chip.key === active;
        const count = counts?.[chip.key];
        return (
          <button
            key={chip.key}
            type="button"
            onClick={() => onChange(chip.key)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isActive
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-foreground border-border hover:bg-muted',
            )}
            aria-pressed={isActive}
          >
            {chip.label}
            {count != null && (
              <Badge
                variant="secondary"
                className={cn(
                  'h-4 px-1.5 text-[10px]',
                  isActive && 'bg-primary-foreground/20 text-primary-foreground',
                )}
              >
                {count}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
