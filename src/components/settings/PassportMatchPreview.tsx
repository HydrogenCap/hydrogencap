import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CheckCircle2, AlertTriangle } from 'lucide-react';
import type { PassportValidatedRow } from '@/lib/passportCsvParser';

interface PassportMatchPreviewProps {
  validatedRows: PassportValidatedRow[];
  validRowCount: number;
  properties: Array<{ id: string; address_line: string }> | undefined;
}

export function PassportMatchPreview({ validatedRows, validRowCount, properties }: PassportMatchPreviewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="bg-success/10 text-success">
          {validRowCount} matched
        </Badge>
        <Badge variant="outline" className="bg-destructive/10 text-destructive">
          {validatedRows.length - validRowCount} unmatched
        </Badge>
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Match Address/Postcode</TableHead>
              <TableHead>Matched Property</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {validatedRows.slice(0, 20).map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  {row.isValid && row.matchedPropertyId ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                  )}
                </TableCell>
                <TableCell className="text-sm">
                  {row.matchAddress || row.matchPostcode || '—'}
                </TableCell>
                <TableCell className="text-sm">
                  {row.matchedPropertyId ? (
                    properties?.find(p => p.id === row.matchedPropertyId)?.address_line
                  ) : (
                    <span className="text-destructive">No match found</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {validatedRows.length > 20 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            Showing first 20 of {validatedRows.length} rows
          </p>
        )}
      </div>
    </div>
  );
}
