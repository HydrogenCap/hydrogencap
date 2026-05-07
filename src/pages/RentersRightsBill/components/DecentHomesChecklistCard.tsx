import { format, parseISO } from 'date-fns';
import { Check, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { RentersRightsBillState } from '../hooks/useRentersRightsBillState';

export function DecentHomesChecklistCard({ state }: { state: RentersRightsBillState }) {
  const { decentItems, toggleDecent, decentScore, decentPct } = state;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Decent Homes Standard
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{decentScore}/{decentItems.length}</span>
            <Badge className={decentPct === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : decentPct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-destructive/10 text-destructive'}>
              {decentPct}%
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p className="text-xs text-muted-foreground">Tick each criterion once you have verified it for your portfolio. Dates are recorded locally.</p>
        {decentItems.map(item => (
          <div
            key={item.key}
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${item.confirmed ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'hover:bg-muted/40'}`}
            onClick={() => toggleDecent(item.key)}
          >
            <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${item.confirmed ? 'bg-emerald-600 border-emerald-600' : 'border-muted-foreground'}`}>
              {item.confirmed && <Check className="h-3 w-3 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium ${item.confirmed ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{item.label}</p>
              <p className="text-xs text-muted-foreground">{item.description}</p>
              {item.confirmed && item.confirmed_date && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Confirmed {format(parseISO(item.confirmed_date), 'dd MMM yyyy')}</p>
              )}
            </div>
          </div>
        ))}
        {decentPct < 100 && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-xs p-2 mt-2">
            ⚠️ The Decent Homes Standard will apply to private rented properties. Properties not meeting the standard may be subject to enforcement action by local authorities.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
