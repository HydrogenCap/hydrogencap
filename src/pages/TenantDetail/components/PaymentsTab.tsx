import { Plus, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AffordabilityMonitor } from '@/components/tenants/AffordabilityMonitor';
import type { TenantDetailState } from '../hooks/useTenantDetailState';

export function PaymentsTab({ state }: { state: TenantDetailState }) {
  const {
    tenant, activeAgreement,
    charges, showAddCharge, setShowAddCharge,
    newCharge, setNewCharge, addCharge, removeCharge,
  } = state;
  if (!tenant) return null;

  return (
    <div className="space-y-6">
      <AffordabilityMonitor tenantId={tenant.id} rentPCM={activeAgreement?.rent_amount_pcm ?? null} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Recurring Charges
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowAddCharge(!showAddCharge)}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {showAddCharge && (
            <div className="flex gap-2 items-end p-3 bg-muted rounded-lg">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                <input className="w-full border rounded px-2 py-1 text-sm" placeholder="e.g. Parking, Cleaning, Internet"
                  value={newCharge.description} onChange={e => setNewCharge(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Amount (£)</label>
                <input className="w-full border rounded px-2 py-1 text-sm" placeholder="0.00" type="number"
                  value={newCharge.amount} onChange={e => setNewCharge(p => ({ ...p, amount: e.target.value }))} />
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <select className="w-full border rounded px-2 py-1 text-sm bg-background"
                  value={newCharge.frequency} onChange={e => setNewCharge(p => ({ ...p, frequency: e.target.value }))}>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annually">Annually</option>
                </select>
              </div>
              <Button size="sm" onClick={addCharge}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowAddCharge(false)}>Cancel</Button>
            </div>
          )}
          {charges.length === 0 && !showAddCharge ? (
            <p className="text-sm text-muted-foreground">No recurring charges set up.</p>
          ) : charges.length > 0 ? (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Description</TableHead><TableHead>Amount</TableHead>
                <TableHead>Frequency</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {charges.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.description}</TableCell>
                    <TableCell>£{Number(c.amount).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{c.frequency}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0" onClick={() => removeCharge(c.id)} aria-label={`Remove charge ${c.description}`}>
                        <X className="h-3 w-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
