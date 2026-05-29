import React from 'react';
import { Users, Building2, User, Plus, Pencil, Trash2, AlertCircle, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useActiveBeneficialOwners,
  useDeleteBeneficialOwner,
  calculateBeneficialSum,
  validateBeneficialSum,
  getOwnerDisplayName,
  type BeneficialOwner,
} from '@/hooks/useBeneficialOwnership';
import { formatPercent, formatDateUK } from '@/lib/calculations';
import { toast } from "sonner";

interface BeneficialOwnersCardProps {
  propertyId: string;
  onAddOwner: () => void;
  onEditOwner: (owner: BeneficialOwner) => void;
}

// Simple donut chart component
function OwnershipDonut({ owners }: { owners: BeneficialOwner[] }) {
  const total = calculateBeneficialSum(owners);
  const colors = [
    'hsl(var(--cat-1))',
    'hsl(var(--cat-2))',
    'hsl(var(--cat-3))',
    'hsl(var(--cat-4))',
    'hsl(var(--cat-5))',
    'hsl(var(--cat-6))',
  ];

  // Calculate segments
  let cumulativePercent = 0;
  const segments = owners
    .filter(o => !o.end_date)
    .map((owner, idx) => {
      const percent = Number(owner.beneficial_percent);
      const startAngle = (cumulativePercent / 100) * 360;
      cumulativePercent += percent;
      const endAngle = (cumulativePercent / 100) * 360;
      return {
        owner,
        color: colors[idx % colors.length],
        startAngle,
        endAngle,
        percent,
      };
    });

  // Add "unallocated" segment if total < 100
  if (total < 100) {
    segments.push({
      owner: null as unknown as BeneficialOwner,
      color: 'hsl(var(--muted))',
      startAngle: (total / 100) * 360,
      endAngle: 360,
      percent: 100 - total,
    });
  }

  return (
    <div className="relative w-32 h-32">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        {segments.map((seg, idx) => {
          const radius = 40;
          const circumference = 2 * Math.PI * radius;
          const dashArray = (seg.percent / 100) * circumference;
          const dashOffset = -((seg.startAngle / 360) * circumference);
          
          return (
            <circle
              key={idx}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth="20"
              strokeDasharray={`${dashArray} ${circumference}`}
              strokeDashoffset={dashOffset}
              className="transition-all duration-300"
            />
          );
        })}
        {/* Inner circle for donut effect */}
        <circle cx="50" cy="50" r="25" fill="hsl(var(--card))" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-lg font-bold ${total === 100 ? 'text-success' : total > 100 ? 'text-destructive' : 'text-warning'}`}>
          {Math.round(total)}%
        </span>
      </div>
    </div>
  );
}

export function BeneficialOwnersCard({ propertyId, onAddOwner, onEditOwner }: BeneficialOwnersCardProps) {
  const { data: owners, isLoading } = useActiveBeneficialOwners(propertyId);
  const deleteOwner = useDeleteBeneficialOwner();
  const handleDelete = async (id: string) => {
    try {
      await deleteOwner.mutateAsync({ id, propertyId });
      toast.success('Beneficial owner removed');
    } catch (error) {
      console.error('Failed to remove beneficial owner:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to remove owner' });
    }
  };

  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-base font-medium">Beneficial Ownership Split</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeOwners = owners || [];
  const total = calculateBeneficialSum(activeOwners);
  const isValid = validateBeneficialSum(total);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="h-5 w-5" />
            Beneficial Ownership Split
          </CardTitle>
          <Button variant="outline" size="sm" onClick={onAddOwner}>
            <Plus className="h-4 w-4 mr-2" />
            Add Owner
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {activeOwners.length === 0 ? (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
            <p className="text-sm text-muted-foreground">No beneficial owners recorded</p>
          </div>
        ) : (
          <>
            {/* Visual + Warning */}
            <div className="flex items-start gap-6">
              <OwnershipDonut owners={activeOwners} />
              <div className="flex-1 space-y-2">
                {/* Legend */}
                {activeOwners.map((owner, idx) => {
                  const colors = ['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5', 'bg-cat-6'];
                  return (
                    <div key={owner.id} className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                      <span className="text-sm">{getOwnerDisplayName(owner)}</span>
                      <span className="text-sm font-medium ml-auto">{formatPercent(Number(owner.beneficial_percent))}</span>
                    </div>
                  );
                })}
                {total < 100 && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <span className="text-sm">Unallocated</span>
                    <span className="text-sm font-medium ml-auto">{formatPercent(100 - total)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status */}
            {!isValid && (
              <Alert variant={total > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
                <AlertCircle className="h-4 w-4 text-warning" />
                <AlertDescription className="text-warning">
                  Beneficial ownership totals {formatPercent(total)} — {total < 100 ? 'incomplete' : 'exceeds 100%'}
                </AlertDescription>
              </Alert>
            )}
            {isValid && (
              <Alert className="border-success bg-success/10">
                <Check className="h-4 w-4 text-success" />
                <AlertDescription className="text-success">
                  Beneficial ownership totals 100%
                </AlertDescription>
              </Alert>
            )}

            {/* Editable Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Owner</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeOwners.map((owner) => (
                    <TableRow key={owner.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {owner.owner_type === 'COMPANY' ? (
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <User className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="font-medium">{getOwnerDisplayName(owner)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {owner.owner_type === 'COMPANY' 
                            ? owner.company?.company_type || 'Company' 
                            : owner.party?.party_type || 'Person'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {formatPercent(Number(owner.beneficial_percent))}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {owner.start_date ? formatDateUK(owner.start_date) : '—'}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                        {owner.notes || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button aria-label="Edit"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEditOwner(owner)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button aria-label="Delete"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleDelete(owner.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
