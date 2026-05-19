import { Edit, Trash2, Plus, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ShareClassWithAllocation } from '@/hooks/useShareCapital';

interface IntegrityError {
  classId: string;
  error: string;
}

interface ShareCapitalSectionProps {
  shareClassesWithAllocation: ShareClassWithAllocation[] | undefined;
  integrityErrors: IntegrityError[];
  entityId: string;
  onAddShareClass: () => void;
  onEditShareClass: (shareClass: ShareClassWithAllocation) => void;
  onDeleteShareClass: (shareClass: ShareClassWithAllocation) => void;
}

export function ShareCapitalSection({
  shareClassesWithAllocation,
  integrityErrors,
  onAddShareClass,
  onEditShareClass,
  onDeleteShareClass,
}: ShareCapitalSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Share Capital</CardTitle>
          <CardDescription>
            Total issued shares: {shareClassesWithAllocation?.reduce((s, sc) => s + sc.issued_shares, 0).toLocaleString() || 0}
            {' '}across {shareClassesWithAllocation?.length || 0} class{(shareClassesWithAllocation?.length || 0) !== 1 ? 'es' : ''}
            {shareClassesWithAllocation && shareClassesWithAllocation.length > 0 && (
              <span className="ml-2">
                · Total capital: £{shareClassesWithAllocation.reduce((s, sc) => s + sc.issued_shares * (sc.nominal_value || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </CardDescription>
        </div>
        <Button size="sm" onClick={onAddShareClass}>
          <Plus className="h-4 w-4 mr-1" /> Add Share Class
        </Button>
      </CardHeader>
      <CardContent>
        {integrityErrors.length > 0 && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-destructive mb-1">
              <AlertTriangle className="h-4 w-4" />
              Share Integrity Error
            </div>
            {integrityErrors.map(err => (
              <p key={err.classId} className="text-xs text-destructive">{err.error}</p>
            ))}
          </div>
        )}

        {shareClassesWithAllocation && shareClassesWithAllocation.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Class</TableHead>
                <TableHead className="text-right">Issued</TableHead>
                <TableHead className="text-right">Allocated</TableHead>
                <TableHead className="text-right">Unallocated</TableHead>
                <TableHead>Nominal</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareClassesWithAllocation.map(sc => (
                <TableRow key={sc.id}>
                  <TableCell className="font-medium">
                    {sc.class_name}
                    {sc.is_primary && <Badge variant="secondary" className="ml-2 text-[10px]">Primary</Badge>}
                  </TableCell>
                  <TableCell className="text-right">{sc.issued_shares.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <span className={sc.allocated_shares > sc.issued_shares ? 'text-destructive font-semibold' : ''}>
                      {sc.allocated_shares.toLocaleString()}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    {sc.unallocated_shares >= 0 ? (
                      <span className="text-muted-foreground">{sc.unallocated_shares.toLocaleString()}</span>
                    ) : (
                      <span className="text-destructive">{sc.unallocated_shares.toLocaleString()}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {sc.nominal_value ? `£${sc.nominal_value}` : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => onEditShareClass(sc)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button aria-label="Delete" variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => onDeleteShareClass(sc)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-6">No share classes defined yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
