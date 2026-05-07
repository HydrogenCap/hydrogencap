import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useCreateTenantV2,
  TENANT_TYPES,
  REFERRAL_SOURCES,
  type TenantStatusV2,
  type TenantTypeV2,
} from '@/hooks/useTenantsV2';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.union([z.string().email(), z.literal('')]).nullable().optional(),
  phone: z.string().nullable().optional(),
  date_of_birth: z.string().nullable().optional(),
  national_insurance: z.string().nullable().optional(),
  referral_source: z.string().nullable().optional(),
  tenant_type: z.string().default('private'),
  status: z.string().default('prospective'),
  emergency_contact_name: z.string().nullable().optional(),
  emergency_contact_phone: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

type FormData = z.infer<typeof schema>;

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

interface AddTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (id: string) => void;
}

export function AddTenantModal({ open, onOpenChange, onSuccess }: AddTenantModalProps) {
  const createTenant = useCreateTenantV2();
  const { toast } = useToast();
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      first_name: '', last_name: '', email: '', phone: '', tenant_type: 'private', status: 'prospective',
    },
  });

  const handleSubmit = async (values: FormData) => {
    try {
      const result = await createTenant.mutateAsync({
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth || null,
        national_insurance: values.national_insurance || null,
        referral_source: values.referral_source || null,
        tenant_type: values.tenant_type as TenantTypeV2,
        status: values.status as TenantStatusV2,
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        notes: values.notes || null,
      });
      toast({ title: 'Welcome aboard', description: `${values.first_name} ${values.last_name} is now in your tenant list.` });
      form.reset();
      onOpenChange(false);
      onSuccess?.(result.id);
    } catch (error: unknown) {
      toast({ title: "Tenant didn't save", description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Tenant</DialogTitle>
          <DialogDescription>
            Add a new tenant — you can link them to a tenancy and room afterward.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          {/* Personal Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Personal Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input {...form.register('first_name')} /></div>
              <div><Label>Last Name *</Label><Input {...form.register('last_name')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" {...form.register('email')} /></div>
              <div><Label>Phone</Label><Input {...form.register('phone')} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date of Birth</Label><Input type="date" {...form.register('date_of_birth')} /></div>
              <div>
                <Label>NI Number</Label>
                <Input {...form.register('national_insurance')} placeholder="Only needed for referencing" />
              </div>
            </div>
          </div>

          {/* Tenancy Details */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tenancy Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tenant Type *</Label>
                <Select value={form.watch('tenant_type')} onValueChange={v => form.setValue('tenant_type', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TENANT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Referral Source</Label>
                <Select value={form.watch('referral_source') || ''} onValueChange={v => form.setValue('referral_source', v || null)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {REFERRAL_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.watch('status')} onValueChange={v => form.setValue('status', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospective">Prospective</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Emergency Contact</Label><Input {...form.register('emergency_contact_name')} /></div>
              <div><Label>Emergency Phone</Label><Input {...form.register('emergency_contact_phone')} /></div>
            </div>
            <div><Label>Notes</Label><Textarea {...form.register('notes')} rows={3} /></div>
          </div>

          <Button type="submit" className="w-full" disabled={createTenant.isPending}>
            {createTenant.isPending ? 'Creating...' : 'Add Tenant'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
