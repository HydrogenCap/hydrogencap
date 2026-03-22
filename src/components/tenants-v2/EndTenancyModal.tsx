import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTenancyAgreement } from '@/hooks/useTenancyAgreements';
import { useUpdateTenantV2 } from '@/hooks/useTenantsV2';
import { useToast } from '@/hooks/use-toast';

const REASONS = [
  { value: 'tenant_notice', label: 'Tenant Notice' },
  { value: 'section_21', label: 'Section 21' },
  { value: 'section_8', label: 'Section 8' },
  { value: 'mutual', label: 'Mutual Agreement' },
  { value: 'abandonment', label: 'Abandonment' },
];

const schema = z.object({
  actual_end_date: z.string().min(1, 'Required'),
  reason: z.string().min(1, 'Required'),
  deposit_deductions: z.coerce.number().optional(),
  deduction_reason: z.string().optional(),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancyId: string;
  tenantId: string;
}

export function EndTenancyModal({ open, onOpenChange, tenancyId, tenantId }: Props) {
  const updateAgreement = useUpdateTenancyAgreement();
  const updateTenant = useUpdateTenantV2();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      actual_end_date: new Date().toISOString().split('T')[0],
      reason: '',
      notes: '',
    },
  });

  const deductions = form.watch('deposit_deductions');
  const reason = form.watch('reason');

  const handleSubmit = async (values: FormData) => {
    try {
      const endNotes = [
        values.notes,
        values.reason ? `Reason: ${REASONS.find(r => r.value === values.reason)?.label}` : null,
        values.deposit_deductions && values.deposit_deductions > 0 ? `Deposit deductions: £${values.deposit_deductions.toFixed(2)} — ${values.deduction_reason || ''}` : null,
      ].filter(Boolean).join('\n');

      await updateAgreement.mutateAsync({
        id: tenancyId,
        actual_end_date: values.actual_end_date,
        status: 'ended',
        notes: endNotes || null,
      });
      await updateTenant.mutateAsync({ id: tenantId, status: 'departed' });
      toast({ title: 'Tenancy ended' });
      onOpenChange(false);
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>End Tenancy</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div><Label>End Date *</Label><Input type="date" {...form.register('actual_end_date')} /></div>
          <div>
            <Label>Reason *</Label>
            <Select value={reason} onValueChange={v => form.setValue('reason', v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Deposit Deductions (£)</Label><Input type="number" step="0.01" {...form.register('deposit_deductions')} /></div>
          {deductions != null && deductions > 0 && (
            <div><Label>Deduction Reason</Label><Textarea {...form.register('deduction_reason')} rows={2} /></div>
          )}
          <div><Label>Notes</Label><Textarea {...form.register('notes')} rows={2} /></div>
          <Button type="submit" variant="destructive" className="w-full" disabled={updateAgreement.isPending}>
            {updateAgreement.isPending ? 'Ending...' : 'End Tenancy'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
