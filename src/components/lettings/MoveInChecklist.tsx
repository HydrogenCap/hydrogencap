import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle, Key, FileText, Banknote, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  useMoveInChecklist,
  useCreateMoveInChecklist,
  useUpdateMoveInItem,
  useCompleteMoveIn,
  type MoveInChecklistItem,
} from '@/hooks/useLettingsWorkflow';
import type { LettingsPipelineItem } from '@/hooks/useLettingsPipeline';

interface CheckItemProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}

function CheckItem({ label, checked, onChange, children }: CheckItemProps) {
  return (
    <div className={cn(
      'rounded-lg border p-3 transition-colors',
      checked ? 'border-green-300 bg-green-50 dark:bg-green-950/20' : 'border-border',
    )}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className="flex-shrink-0"
        >
          {checked
            ? <CheckCircle className="h-5 w-5 text-green-600" />
            : <Circle className="h-5 w-5 text-muted-foreground" />
          }
        </button>
        <span className={cn('text-sm font-medium', checked && 'text-green-700 dark:text-green-400')}>{label}</span>
      </div>
      {children && <div className="ml-8 mt-2">{children}</div>}
    </div>
  );
}

const CHECKLIST_BOOLEAN_FIELDS: (keyof MoveInChecklistItem)[] = [
  'deposit_protected',
  'deposit_prescribed_info_served',
  'standing_order_confirmed',
  'keys_handed_over',
  'meter_readings_recorded',
  'council_tax_notified',
  'utilities_transferred',
  'inventory_completed',
  'inventory_signed',
  'how_to_rent_provided',
  'gas_cert_provided',
  'eicr_provided',
  'epc_provided',
  'welcome_pack_sent',
  'emergency_contacts_collected',
];

interface MoveInChecklistProps {
  item: LettingsPipelineItem;
}

export function MoveInChecklist({ item }: MoveInChecklistProps) {
  const { data: checklist, isLoading } = useMoveInChecklist(item.id);
  const createChecklist = useCreateMoveInChecklist();
  const updateItem = useUpdateMoveInItem();
  const completeMoveIn = useCompleteMoveIn();

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading checklist…</p>;

  if (!checklist) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">No move-in checklist created yet.</p>
        <Button
          onClick={() => createChecklist.mutate({ property_id: item.property_id, letting_id: item.id })}
          disabled={createChecklist.isPending}
        >
          Create Move-In Checklist
        </Button>
      </div>
    );
  }

  const completedCount = CHECKLIST_BOOLEAN_FIELDS.filter(f => checklist[f] === true).length;
  const totalItems = CHECKLIST_BOOLEAN_FIELDS.length;
  const progressPercent = (completedCount / totalItems) * 100;
  const allComplete = completedCount === totalItems;

  const toggle = (field: keyof MoveInChecklistItem, value: boolean) => {
    updateItem.mutate({ id: checklist.id, lettingId: item.id, [field]: value });
  };

  const updateField = (field: keyof MoveInChecklistItem, value: string | number | null) => {
    updateItem.mutate({ id: checklist.id, lettingId: item.id, [field]: value });
  };

  if (checklist.completed_at) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/20 p-4 text-center">
          <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
          <p className="font-medium text-green-700">Move-In Complete</p>
          <p className="text-sm text-green-600 mt-1">
            Completed on {new Date(checklist.completed_at).toLocaleDateString('en-GB')}
          </p>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{completedCount} of {totalItems} items</span>
            <span className="text-muted-foreground">100%</span>
          </div>
          <Progress value={100} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>{completedCount} of {totalItems} complete</span>
          <span className="text-muted-foreground">{Math.round(progressPercent)}%</span>
        </div>
        <Progress value={progressPercent} />
      </div>

      {/* Legal Requirements */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="h-4 w-4" /> Legal Requirements
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CheckItem
            label="Deposit Protected"
            checked={checklist.deposit_protected}
            onChange={v => toggle('deposit_protected', v)}
          >
            <div>
              <Label className="text-xs">Protection Reference</Label>
              <Input
                className="h-8 text-xs"
                defaultValue={checklist.deposit_protection_ref ?? ''}
                placeholder="DPS/MyDeposits reference"
                onBlur={e => {
                  if (e.target.value !== (checklist.deposit_protection_ref ?? ''))
                    updateField('deposit_protection_ref', e.target.value || null);
                }}
              />
            </div>
          </CheckItem>

          <CheckItem
            label="Deposit Prescribed Information Served"
            checked={checklist.deposit_prescribed_info_served}
            onChange={v => toggle('deposit_prescribed_info_served', v)}
          />

          <CheckItem
            label="How to Rent Guide Provided"
            checked={checklist.how_to_rent_provided}
            onChange={v => toggle('how_to_rent_provided', v)}
          />

          <CheckItem
            label="Gas Safety Certificate Provided"
            checked={checklist.gas_cert_provided}
            onChange={v => toggle('gas_cert_provided', v)}
          />

          <CheckItem
            label="EICR (Electrical Safety) Provided"
            checked={checklist.eicr_provided}
            onChange={v => toggle('eicr_provided', v)}
          />

          <CheckItem
            label="EPC Provided"
            checked={checklist.epc_provided}
            onChange={v => toggle('epc_provided', v)}
          />
        </CardContent>
      </Card>

      {/* Financial Setup */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Banknote className="h-4 w-4" /> Financial Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CheckItem
            label="Standing Order Confirmed"
            checked={checklist.standing_order_confirmed}
            onChange={v => toggle('standing_order_confirmed', v)}
          />

          <CheckItem
            label="Council Tax Notified"
            checked={checklist.council_tax_notified}
            onChange={v => toggle('council_tax_notified', v)}
          />

          <CheckItem
            label="Utilities Transferred"
            checked={checklist.utilities_transferred}
            onChange={v => toggle('utilities_transferred', v)}
          />
        </CardContent>
      </Card>

      {/* Property Handover */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" /> Property Handover
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CheckItem
            label="Keys Handed Over"
            checked={checklist.keys_handed_over}
            onChange={v => toggle('keys_handed_over', v)}
          >
            <div>
              <Label className="text-xs">Number of Keys</Label>
              <Input
                className="h-8 text-xs w-24"
                type="number"
                min={0}
                defaultValue={checklist.keys_count ?? ''}
                onBlur={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  if (val !== checklist.keys_count) updateField('keys_count', val);
                }}
              />
            </div>
          </CheckItem>

          <CheckItem
            label="Meter Readings Recorded"
            checked={checklist.meter_readings_recorded}
            onChange={v => toggle('meter_readings_recorded', v)}
          >
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Gas</Label>
                <Input
                  className="h-8 text-xs"
                  defaultValue={checklist.gas_reading ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (checklist.gas_reading ?? ''))
                      updateField('gas_reading', e.target.value || null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Electric</Label>
                <Input
                  className="h-8 text-xs"
                  defaultValue={checklist.electric_reading ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (checklist.electric_reading ?? ''))
                      updateField('electric_reading', e.target.value || null);
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">Water</Label>
                <Input
                  className="h-8 text-xs"
                  defaultValue={checklist.water_reading ?? ''}
                  onBlur={e => {
                    if (e.target.value !== (checklist.water_reading ?? ''))
                      updateField('water_reading', e.target.value || null);
                  }}
                />
              </div>
            </div>
          </CheckItem>

          <CheckItem
            label="Inventory Completed"
            checked={checklist.inventory_completed}
            onChange={v => toggle('inventory_completed', v)}
          />

          <CheckItem
            label="Inventory Signed by Tenant"
            checked={checklist.inventory_signed}
            onChange={v => toggle('inventory_signed', v)}
          />
        </CardContent>
      </Card>

      {/* Documentation */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Home className="h-4 w-4" /> Documentation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <CheckItem
            label="Welcome Pack Sent"
            checked={checklist.welcome_pack_sent}
            onChange={v => toggle('welcome_pack_sent', v)}
          />

          <CheckItem
            label="Emergency Contacts Collected"
            checked={checklist.emergency_contacts_collected}
            onChange={v => toggle('emergency_contacts_collected', v)}
          />
        </CardContent>
      </Card>

      {/* Complete */}
      {allComplete && (
        <Button
          className="w-full"
          onClick={() => completeMoveIn.mutate({ id: checklist.id, lettingId: item.id })}
          disabled={completeMoveIn.isPending}
        >
          <CheckCircle className="h-4 w-4 mr-1" /> Complete Move-In
        </Button>
      )}

      {!allComplete && (
        <p className="text-xs text-muted-foreground text-center">
          Complete all {totalItems - completedCount} remaining items to finalize move-in
        </p>
      )}
    </div>
  );
}
