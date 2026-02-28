import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUpdateMaintenanceRequest } from '@/hooks/useMaintenanceRequests';
import { useAuth } from '@/contexts/AuthContext';
import { PoundSterling, ShieldCheck, TrendingDown, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface CostTrackingSectionProps {
  requestId: string;
  estimatedCost: number | null;
  actualCost: number | null;
  invoiceReference: string | null;
  costApprovedBy: string | null;
  costApprovedAt: string | null;
}

const APPROVAL_THRESHOLD = 500;

export function CostTrackingSection({
  requestId,
  estimatedCost,
  actualCost,
  invoiceReference,
  costApprovedBy,
  costApprovedAt,
}: CostTrackingSectionProps) {
  const [editEstimated, setEditEstimated] = useState(estimatedCost?.toString() || '');
  const [editActual, setEditActual] = useState(actualCost?.toString() || '');
  const [editInvoice, setEditInvoice] = useState(invoiceReference || '');
  const [dirty, setDirty] = useState(false);
  const updateRequest = useUpdateMaintenanceRequest();
  const { user } = useAuth();

  const handleSave = () => {
    updateRequest.mutate({
      id: requestId,
      estimated_cost: editEstimated ? parseFloat(editEstimated) : null,
      actual_cost: editActual ? parseFloat(editActual) : null,
      invoice_reference: editInvoice || null,
    });
    setDirty(false);
  };

  const handleApprove = () => {
    updateRequest.mutate({
      id: requestId,
      cost_approved_by: user?.id,
      cost_approved_at: new Date().toISOString(),
    });
  };

  const estNum = editEstimated ? parseFloat(editEstimated) : null;
  const actNum = editActual ? parseFloat(editActual) : null;
  const variance = estNum && actNum ? actNum - estNum : null;
  const needsApproval = actNum && actNum > APPROVAL_THRESHOLD && !costApprovedBy;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PoundSterling className="h-4 w-4" />
          Costs
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Estimated Cost</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-sm text-muted-foreground">£</span>
              <Input
                type="number"
                value={editEstimated}
                onChange={e => { setEditEstimated(e.target.value); setDirty(true); }}
                className="pl-6"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Actual Cost</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-sm text-muted-foreground">£</span>
              <Input
                type="number"
                value={editActual}
                onChange={e => { setEditActual(e.target.value); setDirty(true); }}
                className="pl-6"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Invoice Reference</Label>
          <Input
            value={editInvoice}
            onChange={e => { setEditInvoice(e.target.value); setDirty(true); }}
            placeholder="e.g. INV-001234"
          />
        </div>

        {/* Variance */}
        {variance !== null && (
          <div className={`flex items-center gap-2 text-sm font-medium ${variance > 0 ? 'text-destructive' : 'text-green-600'}`}>
            {variance > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            £{Math.abs(variance).toFixed(2)} {variance > 0 ? 'over budget' : 'under budget'}
          </div>
        )}

        {/* Approval */}
        {needsApproval && (
          <div className="border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-600" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">Requires Approval</span>
              <Badge variant="outline" className="text-xs">£{actNum.toFixed(0)} exceeds £{APPROVAL_THRESHOLD}</Badge>
            </div>
            <Button size="sm" onClick={handleApprove} disabled={updateRequest.isPending}>
              Approve Cost
            </Button>
          </div>
        )}

        {costApprovedBy && costApprovedAt && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <ShieldCheck className="h-4 w-4" />
            Approved on {format(new Date(costApprovedAt), 'dd MMM yyyy')}
          </div>
        )}

        {dirty && (
          <Button size="sm" onClick={handleSave} disabled={updateRequest.isPending}>
            {updateRequest.isPending ? 'Saving...' : 'Save Costs'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
