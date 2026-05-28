import { Edit, Trash2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { EntityShareholder } from '@/hooks/useLegalEntities';
import type { ShareClassWithAllocation } from '@/hooks/useShareCapital';
import { formatDateUK } from '@/lib/calculations';


interface ShareholdersSectionProps {
  shareholders: EntityShareholder[] | undefined;
  showShareCapital: boolean;
  shareClassesWithAllocation: ShareClassWithAllocation[] | undefined;
  onAddShareholder: () => void;
  onEditShareholder: (shareholder: EntityShareholder) => void;
  onDeleteShareholder: (shareholder: EntityShareholder) => void;
}

export function ShareholdersSection({
  shareholders,
  showShareCapital,
  shareClassesWithAllocation,
  onAddShareholder,
  onEditShareholder,
  onDeleteShareholder,
}: ShareholdersSectionProps) {
  const totalShares = shareholders?.reduce((s, sh) => s + sh.shares_held, 0) || 0;
  const totalPercent = shareholders?.reduce((s, sh) => s + Number(sh.percentage), 0) || 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Shareholders</CardTitle>
          {showShareCapital && shareClassesWithAllocation && shareClassesWithAllocation.length === 0 && (
            <CardDescription className="text-warning">
              Add a share class above before adding shareholders
            </CardDescription>
          )}
        </div>
        <Button
          size="sm"
          onClick={onAddShareholder}
          disabled={showShareCapital && (!shareClassesWithAllocation || shareClassesWithAllocation.length === 0)}
        >
          <Plus className="h-4 w-4 mr-1" /> Add Shareholder
        </Button>
      </CardHeader>
      <CardContent>
        {shareholders && shareholders.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Shareholder Name</TableHead>
                <TableHead>Share Class</TableHead>
                <TableHead className="text-right">Shares Held</TableHead>
                <TableHead className="text-right">Percentage</TableHead>
                <TableHead>Effective Date</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shareholders.map((sh) => (
                <TableRow key={sh.id}>
                  <TableCell className="font-medium">{sh.shareholder_name}</TableCell>
                  <TableCell>{sh.share_class}</TableCell>
                  <TableCell className="text-right">{sh.shares_held.toLocaleString()}</TableCell>
                  <TableCell className="text-right">{Number(sh.percentage).toFixed(2)}%</TableCell>
                  <TableCell>{formatDateUK(sh.effective_date)}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" aria-label="Edit shareholder" className="h-7 w-7" onClick={() => onEditShareholder(sh)}>
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove shareholder"
                        className="h-7 w-7 text-destructive"
                        onClick={() => onDeleteShareholder(sh)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold">
                <TableCell>Total</TableCell>
                <TableCell />
                <TableCell className="text-right">{totalShares.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  <span className={totalPercent > 100.01 ? 'text-destructive' : totalPercent >= 99.99 ? 'text-primary' : ''}>
                    {totalPercent.toFixed(2)}%
                  </span>
                </TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-center py-6">No shareholders added yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
