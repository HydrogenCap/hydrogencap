import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function RoomComplianceCard({ state }: { state: RoomDetailState }) {
  const { compliance } = state;
  return (
    <Card>
      <CardHeader><CardTitle>Room Compliance</CardTitle></CardHeader>
      <CardContent>
        {compliance.length === 0 ? (
          <p className="text-sm text-muted-foreground">No compliance documents for this room.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Expiry Date</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {compliance.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium">{doc.document_type}</TableCell>
                  <TableCell>{doc.issue_date ? format(new Date(doc.issue_date), 'dd MMM yyyy') : '—'}</TableCell>
                  <TableCell>{doc.expiry_date ? format(new Date(doc.expiry_date), 'dd MMM yyyy') : '—'}</TableCell>
                  <TableCell><Badge variant={doc.status === 'valid' ? 'default' : 'destructive'}>{doc.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
