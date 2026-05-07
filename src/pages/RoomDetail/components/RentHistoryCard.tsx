import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fmtRent } from '../utils/format';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function RentHistoryCard({ state }: { state: RoomDetailState }) {
  const { sortedAgreements, rentTrend } = state;
  if (!sortedAgreements || sortedAgreements.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Rent History</CardTitle>
        {rentTrend && (
          <Badge className={rentTrend === 'up' ? 'bg-emerald-100 text-emerald-700' : rentTrend === 'down' ? 'bg-red-100 text-red-700' : 'bg-muted text-muted-foreground'}>
            Rents trending {rentTrend}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead className="text-right">Rent PCM</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedAgreements.map(a => (
                <TableRow key={a.id}>
                  <TableCell><Link to={`/tenants-v2/${a.tenant_id}`} className="text-primary underline">{a.tenant_name || '—'}</Link></TableCell>
                  <TableCell>{format(new Date(a.start_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{a.actual_end_date ? format(new Date(a.actual_end_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell className="text-right font-medium">{fmtRent(a.rent_amount_pcm)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
