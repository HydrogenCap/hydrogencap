import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet } from 'lucide-react';
import { useAccountingExports } from '@/hooks/useAccountingExports';
import { useLegalEntities } from '@/hooks/useLegalEntities';
import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

const TYPE_LABELS: Record<string, string> = {
  income_transactions: 'Income & Expenses',
  combined_journal: 'Combined Journal',
  bank_reconciliation: 'Bank Reconciliation',
  rent_schedule: 'Rent Schedule',
  tax_summary: 'Tax Summary',
  full_package: 'Full Package',
  expense_transactions: 'Expenses',
};

export function ExportHistory() {
  const { data: exports, isLoading } = useAccountingExports();
  const { data: entities } = useLegalEntities();
  const entityMap = useMemo(() => new Map((entities || []).map(e => [e.id, e.entity_name])), [entities]);

  const fmt = (n: number | null) => n != null ? `£${n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : '—';

  if (isLoading) return <p className="text-muted-foreground">Loading export history...</p>;

  if (!exports || exports.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No exports yet. Use the Export tab to create your first export.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Export History</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>System</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead className="text-right">Income</TableHead>
              <TableHead className="text-right">Expenses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exports.map(exp => (
              <TableRow key={exp.id}>
                <TableCell className="text-sm">{exp.generated_at ? format(parseISO(exp.generated_at), 'dd MMM yyyy HH:mm') : '—'}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{TYPE_LABELS[exp.export_type] || exp.export_type}</Badge></TableCell>
                <TableCell className="text-sm">{exp.entity_id ? entityMap.get(exp.entity_id) || '—' : 'All'}</TableCell>
                <TableCell className="text-sm">{exp.period_from} → {exp.period_to}</TableCell>
                <TableCell className="text-sm capitalize">{exp.accounting_system}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{exp.file_name || '—'}</TableCell>
                <TableCell className="text-right font-mono text-sm">{exp.row_count ?? '—'}</TableCell>
                <TableCell className="text-right font-mono text-sm text-green-600">{fmt(exp.total_income)}</TableCell>
                <TableCell className="text-right font-mono text-sm text-red-600">{fmt(exp.total_expenses)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
