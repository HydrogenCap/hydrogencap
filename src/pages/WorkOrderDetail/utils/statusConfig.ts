import { WO_STATUSES } from '@/hooks/useWorkOrders';

export function getStatusConfig(status: string | undefined) {
  return WO_STATUSES.find(s => s.value === status);
}

export { WO_STATUSES };
