import { WarrantyTracker } from '@/components/works/WarrantyTracker';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function WarrantyTab({ state }: { state: WorkOrderDetailState }) {
  const { wo } = state;
  if (!wo) return null;
  return <WarrantyTracker workOrderId={wo.id} propertyId={wo.property_id} />;
}
