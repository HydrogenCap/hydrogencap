import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { WorkOrderPipeline } from '@/components/works/WorkOrderPipeline';
import { ApprovalWorkflow } from '@/components/works/ApprovalWorkflow';
import { ActionButtons } from './ActionButtons';
import { getStatusConfig } from '../utils/statusConfig';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function WorkOrderHeader({ state }: { state: WorkOrderDetailState }) {
  const navigate = useNavigate();
  const { wo, openApproveFromBudget, setShowReject } = state;
  if (!wo) return null;
  const statusConfig = getStatusConfig(wo.status);

  return (
    <>
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/work-orders')} className="mb-2" aria-label="Back to work orders">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-mono text-muted-foreground">{wo.wo_number}</p>
            <h1 className="text-2xl font-bold break-words">{wo.title}</h1>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
              {wo.entity && <span>{wo.entity.entity_name}</span>}
              {wo.property && <span>• {wo.property.address_line_1}, {wo.property.city}</span>}
              {wo.room && <span>• {wo.room.room_name}</span>}
            </div>
          </div>
          <Badge className={cn('text-sm shrink-0 self-start', statusConfig?.color)}>
            {statusConfig?.label}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <WorkOrderPipeline
            wo={wo}
            onApprove={wo.status === 'submitted' ? openApproveFromBudget : undefined}
            onReject={wo.status === 'submitted' ? () => setShowReject(true) : undefined}
          />
        </CardContent>
      </Card>

      {wo.status === 'submitted' && (
        <ApprovalWorkflow defaultThreshold={(wo as { approval_threshold?: number }).approval_threshold || 500} />
      )}

      <Card className="hidden lg:block">
        <CardContent className="py-3"><ActionButtons state={state} /></CardContent>
      </Card>
    </>
  );
}
