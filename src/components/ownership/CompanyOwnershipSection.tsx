import React, { useState } from 'react';
import { Building2, User, Plus, Pencil, Trash2, AlertCircle, Check } from 'lucide-react';
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
  useCompanyOwnership,
  useDeleteOwnershipLink,
  calculateOwnershipTotal,
  validateOwnershipTotal,
  getOwnerName,
  getOwnerType,
  type OwnershipLink,
} from '@/hooks/useOwnershipLinks';
import { UnifiedOwnershipEditor } from './UnifiedOwnershipEditor';
import { useToast } from '@/hooks/use-toast';
import { formatPercent, formatDateUK } from '@/lib/calculations';

interface CompanyOwnershipSectionProps {
  companyId: string;
  companyName: string;
}

export function CompanyOwnershipSection({ companyId, companyName: _companyName }: CompanyOwnershipSectionProps) {
  const { data: links, isLoading } = useCompanyOwnership(companyId);
  const deleteLink = useDeleteOwnershipLink();
  const { toast } = useToast();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<OwnershipLink | null>(null);

  const handleDelete = async (id: string) => {
    try {
      await deleteLink.mutateAsync({ id, subjectType: 'COMPANY', subjectId: companyId });
      toast({ title: 'Shareholder removed' });
    } catch (error) {
      console.error('Failed to remove shareholder:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to remove shareholder', variant: 'destructive' });
    }
  };

  const handleAdd = () => {
    setEditingLink(null);
    setEditorOpen(true);
  };

  const handleEdit = (link: OwnershipLink) => {
    setEditingLink(link);
    setEditorOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Shareholders</CardTitle>
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
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Shareholders
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Shareholder
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Ownership allocated</span>
              <span className={`font-medium ${isValid ? 'text-success' : total > 100 ? 'text-destructive' : 'text-warning'}`}>
                {formatPercent(total)}
              </span>
            </div>
            <Progress value={Math.min(total, 100)} className="h-2" />
            {remaining > 0 && (
              <p className="text-xs text-muted-foreground">{formatPercent(remaining)} unallocated</p>
            )}
          </div>

          {/* Status Alert */}
          {!isValid && activeLinks.length > 0 && (
            <Alert variant={total > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
              <AlertCircle className="h-4 w-4 text-warning" />
              <AlertDescription className="text-warning">
                Total ownership is {formatPercent(total)} — must equal 100%
              </AlertDescription>
            </Alert>
          )}
          {isValid && activeLinks.length > 0 && (
            <Alert className="border-success bg-success/10">
              <Check className="h-4 w-4 text-success" />
              <AlertDescription className="text-success">
                Ownership fully allocated
              </AlertDescription>
            </Alert>
          )}

          {activeLinks.length === 0 ? (
            <div className="flex items-center justify-center p-8 border-2 border-dashed border-muted rounded-lg">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-3">No shareholders recorded</p>
                <Button variant="outline" size="sm" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Shareholder
                </Button>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shareholder</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead>Since</TableHead>
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
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getOwnerType(link)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          {formatPercent(Number(link.percent))}
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {link.shares ? link.shares.toLocaleString() : '—'}
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
                              onClick={() => handleEdit(link)}
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
          )}
        </CardContent>
      </Card>

      <UnifiedOwnershipEditor
        subjectType="COMPANY"
        subjectId={companyId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        editingLink={editingLink}
      />
    </>
  );
}
