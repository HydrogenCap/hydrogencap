import { Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { COST_CATEGORIES } from '@/hooks/useWorkOrders';
import { formatGBP } from '../utils/format';
import type { WorkOrderDetailState } from '../hooks/useWorkOrderDetailState';

export function CostsTab({ state }: { state: WorkOrderDetailState }) {
  const { wo, deleteCost, setShowAddCost } = state;
  if (!wo) return null;
  const costTotal = (wo.cost_items || []).reduce((s, i) => s + i.amount + (i.vat_amount || 0), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">Cost Items ({wo.cost_items?.length || 0})</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{formatGBP(costTotal)}</span>
          <Button size="sm" variant="outline" onClick={() => setShowAddCost(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {(wo.cost_items || []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No cost items yet</p>
        ) : (
          <div className="space-y-2">
            {wo.cost_items.map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {COST_CATEGORIES.find(c => c.value === item.category)?.label}
                    {item.is_estimated && ' - Estimated'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{formatGBP(item.amount + (item.vat_amount || 0))}</span>
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteCost.mutate({ id: item.id, workOrderId: wo.id })}
                    aria-label={`Delete cost item ${item.description}`}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
