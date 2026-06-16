import { useState } from 'react';
import { Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGBPDecimal } from '@/lib/calculations';

export interface PaymentLineItem {
  id: string;
  investor?: { investor_name: string; email: string | null } | null;
  ownership_pct: number;
  gross_amount: number;
  withholding_tax: number;
  net_amount: number;
  payment_status: string;
  payment_reference: string | null;
  paid_at: string | null;
}

interface Props {
  lineItems: PaymentLineItem[];
  runId: string | null;
  onMarkPaid: (id: string, reference?: string) => void;
  onMarkAllPaid: () => void;
  isPending: boolean;
  onClose: () => void;
}

export function PaymentTrackingStep({
  lineItems,
  runId: _runId,
  onMarkPaid,
  onMarkAllPaid,
  isPending,
  onClose,
}: Props) {
  const [references, setReferences] = useState<Record<string, string>>({});
  const pendingCount = lineItems.filter(li => li.payment_status === 'pending').length;
  const paidCount = lineItems.filter(li => li.payment_status === 'paid').length;

  if (lineItems.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Distribution created successfully. Payment tracking will be available once line items are loaded.</p>
        <Button className="mt-4" onClick={onClose}>Close</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="default">{paidCount} Paid</Badge>
          <Badge variant="secondary">{pendingCount} Pending</Badge>
        </div>
        {pendingCount > 0 && (
          <Button size="sm" onClick={onMarkAllPaid} disabled={isPending}>
            Mark All Paid
          </Button>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Investor</TableHead>
              <TableHead className="text-right">Net Amount</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead>Payment Reference</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map(li => (
              <TableRow key={li.id}>
                <TableCell className="font-medium">
                  {li.investor?.investor_name || 'Unknown'}
                  {li.investor?.email && (
                    <span className="block text-xs text-muted-foreground">{li.investor.email}</span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono">{formatGBPDecimal(li.net_amount)}</TableCell>
                <TableCell className="text-center">
                  {li.payment_status === 'paid' ? (
                    <Badge className="bg-success text-success-foreground">Paid</Badge>
                  ) : li.payment_status === 'failed' ? (
                    <Badge variant="destructive">Failed</Badge>
                  ) : (
                    <Badge variant="secondary">Pending</Badge>
                  )}
                </TableCell>
                <TableCell>
                  {li.payment_status === 'paid' ? (
                    <span className="text-sm text-muted-foreground">{li.payment_reference || '—'}</span>
                  ) : (
                    <Input
                      className="h-8 text-sm"
                      placeholder="Reference..."
                      value={references[li.id] || ''}
                      onChange={e => setReferences(prev => ({ ...prev, [li.id]: e.target.value }))}
                    />
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {li.payment_status === 'pending' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onMarkPaid(li.id, references[li.id])}
                      disabled={isPending}
                    >
                      <Check className="h-3 w-3 mr-1" /> Paid
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
