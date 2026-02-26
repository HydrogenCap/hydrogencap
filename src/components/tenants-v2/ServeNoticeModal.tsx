import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useUpdateTenancyAgreement, NOTICE_TYPES, type TenancyComplianceCheck } from '@/hooks/useTenancyAgreements';
import { useUpdateTenantV2 } from '@/hooks/useTenantsV2';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

const schema = z.object({
  notice_type: z.string().min(1, 'Required'),
  notice_served_date: z.string().min(1, 'Required'),
  notes: z.string().optional(),
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenancyId: string;
  tenantId: string;
  compliance?: TenancyComplianceCheck | null;
}

export function ServeNoticeModal({ open, onOpenChange, tenancyId, tenantId, compliance }: Props) {
  const updateAgreement = useUpdateTenancyAgreement();
  const updateTenant = useUpdateTenantV2();
  const { toast } = useToast();
  const [confirmed, setConfirmed] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      notice_type: '',
      notice_served_date: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const noticeType = form.watch('notice_type');
  const showS21Warning = noticeType === 'section_21' && compliance && !compliance.section_21_ready;

  const issues: string[] = [];
  if (showS21Warning && compliance) {
    if (compliance.deposit_compliance === 'missing_scheme') issues.push('Deposit scheme not recorded');
    if (compliance.deposit_compliance === 'not_protected') issues.push('Deposit not protected');
    if (compliance.deposit_compliance === 'no_prescribed_info') issues.push('Prescribed information not served');
    if (compliance.how_to_rent_compliance === 'not_served') issues.push('How to Rent guide not served');
  }

  const handleSubmit = async (values: z.infer<typeof schema>) => {
    if (showS21Warning && !confirmed) {
      setConfirmed(true);
      return;
    }
    try {
      await updateAgreement.mutateAsync({
        id: tenancyId,
        notice_served_date: values.notice_served_date,
        notice_type: values.notice_type as any,
        status: 'notice_period',
      });
      await updateTenant.mutateAsync({ id: tenantId, status: 'in_notice' });
      toast({ title: 'Notice served' });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Serve Notice</DialogTitle></DialogHeader>

        {showS21Warning && (
          <Alert variant="destructive" className="border-2">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription>
              <p className="font-bold mb-1">WARNING: Section 21 pre-conditions NOT met</p>
              <p className="text-sm mb-2">This tenancy does not currently meet the pre-conditions for a valid Section 21 notice:</p>
              <ul className="list-disc pl-4 text-sm space-y-1">
                {issues.map((issue, i) => <li key={i}>{issue}</li>)}
              </ul>
              {confirmed && <p className="mt-2 font-semibold text-sm">Click &ldquo;Serve Notice&rdquo; again to proceed despite these warnings.</p>}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div>
            <Label>Notice Type *</Label>
            <Select value={noticeType} onValueChange={v => { form.setValue('notice_type', v); setConfirmed(false); }}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {NOTICE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Date Served *</Label><Input type="date" {...form.register('notice_served_date')} /></div>
          <div><Label>Notes</Label><Textarea {...form.register('notes')} rows={3} /></div>

          <Button type="submit" className="w-full" variant={showS21Warning ? 'destructive' : 'default'} disabled={updateAgreement.isPending}>
            {updateAgreement.isPending ? 'Saving...' : showS21Warning && !confirmed ? 'Acknowledge & Continue' : 'Serve Notice'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
