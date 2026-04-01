import React from 'react';
import { Users, Building2, User, Plus, Pencil, Trash2, AlertCircle, Check, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  usePropertyBeneficialOwnership,
  useDeleteOwnershipLink,
  calculateOwnershipTotal,
  validateOwnershipTotal,
  getOwnerName,
  getOwnerType,
  type OwnershipLink,
} from '@/hooks/useOwnershipLinks';
import { useToast } from '@/hooks/use-toast';
import { formatPercent, formatDateUK } from '@/lib/calculations';

interface UnifiedOwnershipCardProps {
  propertyId: string;
  onAddOwner: () => void;
  onEditOwner: (link: OwnershipLink) => void;
}

// Donut chart component for visual representation
function OwnershipDonut({ links }: { links: OwnershipLink[] }) {
  const total = calculateOwnershipTotal(links);
  const colors = [
    'hsl(var(--primary))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
    'hsl(var(--muted-foreground))',
  ];

  let cumulativePercent = 0;
  const segments = links
    .filter(l => !l.effective_to)
    .map((link, idx) => {
      const percent = Number(link.percent);
      const startAngle = (cumulativePercent / 100) * 360;
      cumulativePercent += percent;
      const endAngle = (cumulativePercent / 100) * 360;
      return {
        link,
        color: colors[idx % colors.length],
        startAngle,
        endAngle,
        percent,
      };
    });

  if (total < 100) {
    segments.push({
      link: null as unknown as OwnershipLink,
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

export function UnifiedOwnershipCard({ propertyId, onAddOwner, onEditOwner }: UnifiedOwnershipCardProps) {
  const { data: links, isLoading } = usePropertyBeneficialOwnership(propertyId);
  const deleteLink = useDeleteOwnershipLink();
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try {
      await deleteLink.mutateAsync({ id, subjectType: 'PROPERTY', subjectId: propertyId });
      toast({ title: 'Beneficial owner removed' });
    } catch (error) {
      console.error('Failed to remove beneficial owner:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove owner', variant: 'destructive' });
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

  const activeLinks = links || [];
  const total = calculateOwnershipTotal(activeLinks);
  const isValid = validateOwnershipTotal(total);
  const remaining = 100 - total;

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
        {activeLinks.length === 0 ? (
          <div className="flex items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
            <p className="text-sm text-muted-foreground">No beneficial owners recorded</p>
          </div>
        ) : (
          <>
            {/* Visual + Progress */}
            <div className="flex items-start gap-6">
              <OwnershipDonut links={activeLinks} />
              <div className="flex-1 space-y-3">
                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total allocated</span>
                    <span className={`font-medium ${isValid ? 'text-success' : total > 100 ? 'text-destructive' : 'text-warning'}`}>
                      {formatPercent(total)}
                    </span>
                  </div>
                  <Progress value={Math.min(total, 100)} className="h-2" />
                  {remaining > 0 && (
                    <p className="text-xs text-muted-foreground">{formatPercent(remaining)} remaining</p>
                  )}
                </div>

                {/* Legend */}
                <div className="space-y-1.5">
                  {activeLinks.map((link, idx) => {
                    const colors = ['bg-primary', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];
                    const isCompany = link.owner_party?.party_type === 'COMPANY';
                    return (
                      <div key={link.id} className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${colors[idx % colors.length]}`} />
                        <span className="text-sm truncate">{getOwnerName(link)}</span>
                        {isCompany && link.owner_party?.company_number && (
                          <Badge variant="outline" className="text-xs">
                            {link.owner_party.company_number}
                          </Badge>
                        )}
                        <span className="text-sm font-medium ml-auto">{formatPercent(Number(link.percent))}</span>
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
            </div>

            {/* Status Alert */}
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
                    <TableHead>Source</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeLinks.map((link) => {
                    const isCompany = link.owner_party?.party_type === 'COMPANY';
                    return (
                      <TableRow key={link.id} className="group">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isCompany ? (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <User className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="font-medium">{getOwnerName(link)}</span>
                            {isCompany && link.owner_party?.company_number && (
                              <Link
                                to={`/companies`}
                                className="text-primary hover:underline"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getOwnerType(link)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatPercent(Number(link.percent))}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {link.effective_from ? formatDateUK(link.effective_from) : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {link.source}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => onEditOwner(link)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDelete(link.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
