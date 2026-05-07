import { MaterialTracker } from '@/components/works/MaterialTracker';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function MaterialsTab({ state }: { state: WorkOrderDetailState }) {
  const { wo } = state;
  if (!wo) return null;
  return <MaterialTracker workOrderId={wo.id} approvedBudget={wo.approved_budget} />;
}
