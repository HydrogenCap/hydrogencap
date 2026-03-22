import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import {
  useCreateTenancyAgreement,
  TENANCY_TYPES,
  RENT_FREQUENCIES,
  DEPOSIT_SCHEMES,
  type DepositScheme,
  type TenancyType,
} from '@/hooks/useTenancyAgreements';
import { useTenantsV2 } from '@/hooks/useTenantsV2';
import { usePropertiesV2 } from '@/hooks/usePropertiesV2';
import { usePropertyRooms } from '@/hooks/useRoomsV2';
import { useUpdateTenantV2 } from '@/hooks/useTenantsV2';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  tenant_id: z.string().min(1, 'Required'),
  property_id: z.string().min(1, 'Required'),
  room_id: z.string().min(1, 'Required'),
  tenancy_type: z.string().default('ast'),
  start_date: z.string().min(1, 'Required'),
  initial_end_date: z.string().optional(),
  rent_amount_pcm: z.coerce.number().positive('Must be positive'),
  rent_frequency: z.string().default('monthly'),
  deposit_amount: z.coerce.number().optional(),
  deposit_scheme: z.string().optional(),
  deposit_reference: z.string().optional(),
  deposit_protected_date: z.string().optional(),
  prescribed_info_served_date: z.string().optional(),
  how_to_rent_served_date: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedTenantId?: string;
  preselectedPropertyId?: string;
  preselectedRoomId?: string;
  onSuccess?: (tenantId: string) => void;
}

export function CreateTenancyAgreementModal({ open, onOpenChange, preselectedTenantId, preselectedPropertyId, preselectedRoomId, onSuccess }: Props) {
  const createAgreement = useCreateTenancyAgreement();
  const updateTenant = useUpdateTenantV2();
  const { data: tenantsData } = useTenantsV2();
  const tenants = tenantsData?.items;
  const { data: properties } = usePropertiesV2();
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(true);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      tenant_id: preselectedTenantId || '',
      property_id: preselectedPropertyId || '',
      room_id: preselectedRoomId || '',
      tenancy_type: 'ast',
      start_date: new Date().toISOString().split('T')[0],
      rent_frequency: 'monthly',
    },
  });

  const selectedPropertyId = form.watch('property_id');
  const selectedRoomId = form.watch('room_id');
  const depositAmount = form.watch('deposit_amount');
  const startDate = form.watch('start_date');
  const depositScheme = form.watch('deposit_scheme');
  const { data: rooms } = usePropertyRooms(selectedPropertyId);

  // Auto-fill rent from room
  useEffect(() => {
    if (selectedRoomId && rooms) {
      const room = rooms.find(r => r.id === selectedRoomId);
      if (room) {
        const rent = room.target_rent_pcm || room.current_rent_pcm;
        if (rent) form.setValue('rent_amount_pcm', rent);
      }
    }
  }, [form, rooms, selectedRoomId]);

  // Reset defaults when opening
  useEffect(() => {
    if (open) {
      form.reset({
        tenant_id: preselectedTenantId || '',
        property_id: preselectedPropertyId || '',
        room_id: preselectedRoomId || '',
        tenancy_type: 'ast',
        start_date: new Date().toISOString().split('T')[0],
        rent_frequency: 'monthly',
      });
    }
  }, [form, open, preselectedPropertyId, preselectedRoomId, preselectedTenantId]);

  const warnings: string[] = [];
  if (startDate && new Date(startDate) < new Date(new Date().toISOString().split('T')[0])) {
    warnings.push('Start date is in the past');
  }
  if (depositAmount && depositAmount > 0 && !depositScheme) {
    warnings.push('Deposit amount entered but no scheme selected');
  }
  const selectedRoom = rooms?.find(r => r.id === selectedRoomId);
  if (selectedRoom?.occupancy_status === 'occupied') {
    warnings.push('This room already has an active tenancy');
  }

  const handleSubmit = async (values: FormData) => {
    try {
      const result = await createAgreement.mutateAsync({
        tenant_id: values.tenant_id,
        property_id: values.property_id,
        room_id: values.room_id,
        tenancy_type: values.tenancy_type as TenancyType,
        start_date: values.start_date,
        initial_end_date: values.initial_end_date || null,
        actual_end_date: null,
        rent_amount_pcm: values.rent_amount_pcm,
        rent_frequency: values.rent_frequency,
        deposit_amount: values.deposit_amount || null,
        deposit_scheme: (values.deposit_scheme as DepositScheme | undefined) || null,
        deposit_reference: values.deposit_reference || null,
        deposit_protected_date: values.deposit_protected_date || null,
        prescribed_info_served_date: values.prescribed_info_served_date || null,
        how_to_rent_served_date: values.how_to_rent_served_date || null,
        is_periodic: !values.initial_end_date,
        notice_served_date: null,
        notice_type: null,
        status: 'active',
        notes: values.notes || null,
      });

      // Update tenant status to active if prospective
      const tenant = tenants?.find(t => t.id === values.tenant_id);
      if (tenant?.status === 'prospective') {
        await updateTenant.mutateAsync({ id: tenant.id, status: 'active' });
      }

      toast({ title: 'Tenancy agreement created' });
      onOpenChange(false);
      onSuccess?.(values.tenant_id);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Tenancy Agreement</DialogTitle></DialogHeader>

        {warnings.length > 0 && (
          <Alert variant="default" className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              {warnings.map((w, i) => <p key={i}>{w}</p>)}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          {/* Tenant */}
          <div>
            <Label>Tenant *</Label>
            <Select value={form.watch('tenant_id')} onValueChange={v => form.setValue('tenant_id', v)}>
              <SelectTrigger><SelectValue placeholder="Select tenant..." /></SelectTrigger>
              <SelectContent>
                {(tenants || []).map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.last_name}, {t.first_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Property */}
          <div>
            <Label>Property *</Label>
            <Select value={form.watch('property_id')} onValueChange={v => { form.setValue('property_id', v); form.setValue('room_id', ''); }}>
              <SelectTrigger><SelectValue placeholder="Select property..." /></SelectTrigger>
              <SelectContent>
                {(properties || []).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.address_line_1}, {p.city}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Room */}
          <div>
            <Label>Room *</Label>
            <Select value={form.watch('room_id')} onValueChange={v => form.setValue('room_id', v)} disabled={!selectedPropertyId}>
              <SelectTrigger><SelectValue placeholder={selectedPropertyId ? 'Select room...' : 'Select property first'} /></SelectTrigger>
              <SelectContent>
                {(rooms || []).filter(r => r.is_lettable).map(r => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.room_name} ({r.room_type}) — {r.occupancy_status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tenancy Type *</Label>
              <Select value={form.watch('tenancy_type')} onValueChange={v => form.setValue('tenancy_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TENANCY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rent Frequency</Label>
              <Select value={form.watch('rent_frequency')} onValueChange={v => form.setValue('rent_frequency', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RENT_FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Date *</Label><Input type="date" {...form.register('start_date')} /></div>
            <div><Label>Fixed Term End Date</Label><Input type="date" {...form.register('initial_end_date')} placeholder="Leave blank for periodic" /></div>
          </div>

          <div>
            <Label>Rent Amount PCM (£) *</Label>
            <Input type="number" step="0.01" {...form.register('rent_amount_pcm')} />
          </div>

          {/* Deposit */}
          <Collapsible open={depositOpen} onOpenChange={setDepositOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" type="button" className="w-full justify-between text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Deposit <ChevronDown className={`h-4 w-4 transition-transform ${depositOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div><Label>Deposit Amount (£)</Label><Input type="number" step="0.01" {...form.register('deposit_amount')} /></div>
              {depositAmount && depositAmount > 0 && (
                <>
                  <div>
                    <Label>Deposit Scheme</Label>
                    <Select value={form.watch('deposit_scheme') || ''} onValueChange={v => form.setValue('deposit_scheme', v)}>
                      <SelectTrigger><SelectValue placeholder="Select scheme..." /></SelectTrigger>
                      <SelectContent>
                        {DEPOSIT_SCHEMES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Deposit Reference</Label><Input {...form.register('deposit_reference')} /></div>
                  <div><Label>Date Protected</Label><Input type="date" {...form.register('deposit_protected_date')} /></div>
                  <div><Label>Prescribed Info Served Date</Label><Input type="date" {...form.register('prescribed_info_served_date')} /></div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Compliance */}
          <div>
            <Label>How to Rent Guide Served Date</Label>
            <Input type="date" {...form.register('how_to_rent_served_date')} />
          </div>

          <div><Label>Notes</Label><Textarea {...form.register('notes')} rows={2} /></div>

          <Button type="submit" className="w-full" disabled={createAgreement.isPending}>
            {createAgreement.isPending ? 'Creating...' : 'Create Agreement'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
