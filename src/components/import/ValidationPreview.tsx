import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { type ValidatedRow, PROPERTY_FIELDS } from '@/lib/csvParser';

interface ValidationPreviewProps {
  validatedRows: ValidatedRow[];
  mapping: Record<string, string>;
}

export function ValidationPreview({ validatedRows, mapping }: ValidationPreviewProps) {
  const mappedFields = PROPERTY_FIELDS.filter(f => 
    Object.values(mapping).includes(f.key)
  );

  const validCount = validatedRows.filter(r => r.isValid).length;
  const invalidCount = validatedRows.length - validCount;

  const formatValue = (value: string | number | null): string => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'number') {
      if (String(value).includes('.')) {
        return value.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      return value.toLocaleString('en-GB');
    }
    return String(value);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-foreground">Validation Preview</h3>
        <div className="flex items-center gap-3">
          <Badge variant="default" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {validCount} valid
          </Badge>
          {invalidCount > 0 && (
            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
              <XCircle className="h-3 w-3 mr-1" />
              {invalidCount} invalid
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="border border-border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-16 sticky left-0 bg-muted/50">Status</TableHead>
              {mappedFields.map((field) => (
                <TableHead key={field.key} className="whitespace-nowrap">
                  {field.label}
                  {field.required && <span className="text-destructive ml-1">*</span>}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {validatedRows.slice(0, 50).map((row, index) => (
              <TableRow 
                key={`row-${index}-${row.isValid}`} 
                className={row.isValid ? '' : 'bg-destructive/5'}
              >
                <TableCell className="sticky left-0 bg-background">
                  {row.isValid ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <div className="group relative">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <div className="absolute left-6 top-0 z-10 hidden group-hover:block bg-popover border border-border rounded-md p-2 shadow-lg min-w-48">
                        <ul className="text-xs text-destructive space-y-1">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err.message}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </TableCell>
                {mappedFields.map((field) => {
                  const value = row.data[field.key];
                  const hasError = row.errors.some(e => e.field === field.key);
                  
                  return (
                    <TableCell 
                      key={field.key}
                      className={`whitespace-nowrap ${hasError ? 'text-destructive' : ''}`}
                    >
                      {formatValue(value)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {validatedRows.length > 50 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing first 50 of {validatedRows.length} rows
        </p>
      )}
    </div>
  );
}
