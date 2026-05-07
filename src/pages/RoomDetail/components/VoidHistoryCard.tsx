import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function VoidHistoryCard({ state }: { state: RoomDetailState }) {
  const { voidPeriods } = state;
  return (
    <Card>
      <CardHeader><CardTitle>Void History</CardTitle></CardHeader>
      <CardContent>
        {voidPeriods.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No void periods recorded.</p>
        ) : (
          <div className="space-y-3">
            {voidPeriods.map((v, i) => (
              <div key={i} className="flex items-center justify-between text-sm border-b pb-2 last:border-0">
                <div>
                  <span>{format(new Date(v.start), 'dd/MM/yyyy')}</span>
                  <span className="mx-2">→</span>
                  <span>{v.end ? format(new Date(v.end), 'dd/MM/yyyy') : 'Present'}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{v.days} days</span>
                  <span className="text-destructive font-semibold">-£{v.cost.toFixed(2)}</span>
                </div>
              </div>
            ))}
            <div className="border-t pt-2 flex justify-between text-sm font-semibold">
              <span>Total void cost</span>
              <span className="text-destructive">-£{voidPeriods.reduce((s, v) => s + v.cost, 0).toFixed(2)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
