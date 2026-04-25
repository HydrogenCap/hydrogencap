import { useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { ChevronDown, ChevronRight, History, Plus, Pencil, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useRecordAuditHistory } from '@/hooks/useAuditLog';
import { humanizeFieldName, formatAuditValue } from '@/lib/auditLogTypes';

interface Props {
  tableName: string;
  recordId: string | undefined;
  title?: string;
}

const ACTION_STYLES = {
  INSERT: { label: 'Created', variant: 'default' as const, icon: Plus, color: 'text-success' },
  UPDATE: { label: 'Updated', variant: 'secondary' as const, icon: Pencil, color: 'text-warning' },
  DELETE: { label: 'Deleted', variant: 'destructive' as const, icon: Trash2, color: 'text-destructive' },
};

export function InlineAuditHistory({ tableName, recordId, title = 'Change History' }: Props) {
  const [open, setOpen] = useState(false);
  const { data: entries, isLoading } = useRecordAuditHistory(tableName, recordId);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  if (!recordId) return null;
  if (!isLoading && (!entries || entries.length === 0)) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <History className="h-3 w-3" />
        <span>{title}</span>
        {entries && entries.length > 0 && (
          <Badge variant="secondary" className="h-4 text-[10px] px-1.5">{entries.length}</Badge>
        )}
      </CollapsibleTrigger>
      <CollapsibleContent>
        {isLoading ? (
          <Skeleton className="h-16 mt-2" />
        ) : (
          <div className="mt-2 border-l-2 border-border pl-4 space-y-3">
            {entries?.map(entry => {
              const style = ACTION_STYLES[entry.action as keyof typeof ACTION_STYLES];
              const Icon = style.icon;
              const isEntryExpanded = expandedEntry === entry.id;

              return (
                <div key={entry.id} className="relative">
                  <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-border" />
                  <button
                    onClick={() => setExpandedEntry(isEntryExpanded ? null : entry.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant={style.variant} className="text-[10px] gap-0.5 h-4 px-1.5">
                        <Icon className="h-2.5 w-2.5" />
                        {style.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.changed_at), { addSuffix: true })}
                      </span>
                      {entry.changed_fields && (
                        <span className="text-[10px] text-muted-foreground">
                          ({entry.changed_fields.length} field{entry.changed_fields.length !== 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                  </button>

                  {isEntryExpanded && entry.action === 'UPDATE' && entry.changed_fields && (
                    <div className="mt-2 ml-1 text-xs space-y-1">
                      {entry.changed_fields.map(field => (
                        <div key={field} className="flex items-baseline gap-2">
                          <span className="text-muted-foreground min-w-[100px]">{humanizeFieldName(field)}</span>
                          <span className="text-destructive line-through text-[10px]">
                            {formatAuditValue(field, entry.old_values?.[field])}
                          </span>
                          <span className="text-[10px]">→</span>
                          <span className="text-success font-medium text-[10px]">
                            {formatAuditValue(field, entry.new_values?.[field])}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {isEntryExpanded && entry.action === 'INSERT' && entry.new_values && (
                    <div className="mt-2 ml-1 text-[10px] text-muted-foreground">
                      Record created on {format(new Date(entry.changed_at), 'dd/MM/yyyy HH:mm')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
