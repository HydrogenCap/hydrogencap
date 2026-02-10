import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { sanitizeText } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateTenant, type Tenant, type TenantStatus } from '@/hooks/useTenants';
import { ScrollArea } from '@/components/ui/scroll-area';

interface EditTenantDialogProps {
  tenant: Tenant;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const schema = z.object({
  first_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  last_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  phone: z.string().optional().nullable(),
  date_of_birth: z.string().optional().nullable(),
  national_insurance: z.string().optional().nullable(),
  company_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  company_number: z.string().optional().nullable(),
  company_registered_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  company_contact_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  company_contact_email: z.string().email().optional().or(z.literal('')).nullable(),
  company_contact_phone: z.string().optional().nullable(),
  company_contact_role: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  trading_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  vat_number: z.string().optional().nullable(),
  compliance_contact_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  compliance_contact_email: z.string().email().optional().or(z.literal('')).nullable(),
  employment_status: z.string().optional().nullable(),
  employer_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  annual_income: z.coerce.number().optional().nullable(),
  emergency_contact_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  emergency_contact_phone: z.string().optional().nullable(),
  emergency_contact_relationship: z.string().optional().nullable(),
  guarantor_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  guarantor_email: z.string().optional().nullable(),
  guarantor_phone: z.string().optional().nullable(),
  guarantor_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  previous_address: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  previous_landlord_name: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  previous_landlord_phone: z.string().optional().nullable(),
  notes: z.string().optional().nullable().transform((v) => v ? sanitizeText(v) : v),
  status: z.enum(['prospect', 'active', 'past', 'blacklisted']),
});

type FormValues = z.infer<typeof schema>;

export function EditTenantDialog({ tenant, open, onOpenChange }: EditTenantDialogProps) {
  const updateTenant = useUpdateTenant();
  const isCompany = tenant.tenant_type === 'company';

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: tenantToForm(tenant),
  });

  useEffect(() => {
    if (open) {
      form.reset(tenantToForm(tenant));
    }
  }, [open, tenant]);

  function tenantToForm(t: Tenant): FormValues {
    return {
      first_name: t.first_name || '',
      last_name: t.last_name || '',
      email: t.email || '',
      phone: t.phone || '',
      date_of_birth: t.date_of_birth || '',
      national_insurance: t.national_insurance || '',
      company_name: t.company_name || '',
      company_number: t.company_number || '',
      company_registered_address: t.company_registered_address || '',
      company_contact_name: t.company_contact_name || '',
      company_contact_email: t.company_contact_email || '',
      company_contact_phone: t.company_contact_phone || '',
      company_contact_role: t.company_contact_role || '',
      trading_name: t.trading_name || '',
      vat_number: t.vat_number || '',
      compliance_contact_name: t.compliance_contact_name || '',
      compliance_contact_email: t.compliance_contact_email || '',
      employment_status: t.employment_status || '',
      employer_name: t.employer_name || '',
      annual_income: t.annual_income,
      emergency_contact_name: t.emergency_contact_name || '',
      emergency_contact_phone: t.emergency_contact_phone || '',
      emergency_contact_relationship: t.emergency_contact_relationship || '',
      guarantor_name: t.guarantor_name || '',
      guarantor_email: t.guarantor_email || '',
      guarantor_phone: t.guarantor_phone || '',
      guarantor_address: t.guarantor_address || '',
      previous_address: t.previous_address || '',
      previous_landlord_name: t.previous_landlord_name || '',
      previous_landlord_phone: t.previous_landlord_phone || '',
      notes: t.notes || '',
      status: t.status,
    };
  }

  async function onSubmit(values: FormValues) {
    const updates: Record<string, any> = {};
    for (const [key, val] of Object.entries(values)) {
      updates[key] = val === '' ? null : val;
    }
    await updateTenant.mutateAsync({ id: tenant.id, ...updates });
    onOpenChange(false);
  }

  const Field = ({ label, name, type = 'text' }: { label: string; name: keyof FormValues; type?: string }) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        {...form.register(name as any)}
        className="h-8 text-sm"
      />
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Edit Tenant</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 px-6">
          <form id="edit-tenant-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pb-6">
            {/* Status */}
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as TenantStatus)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="past">Past</SelectItem>
                  <SelectItem value="blacklisted">Blacklisted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCompany ? (
              <>
                <p className="text-sm font-semibold pt-2">Company Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company Name" name="company_name" />
                  <Field label="Company Number" name="company_number" />
                  <Field label="Trading Name" name="trading_name" />
                  <Field label="VAT Number" name="vat_number" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registered Address</Label>
                  <Textarea {...form.register('company_registered_address')} rows={2} className="text-sm" />
                </div>

                <p className="text-sm font-semibold pt-2">Primary Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" name="company_contact_name" />
                  <Field label="Role" name="company_contact_role" />
                  <Field label="Email" name="company_contact_email" type="email" />
                  <Field label="Phone" name="company_contact_phone" type="tel" />
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold pt-2">Personal Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="First Name" name="first_name" />
                  <Field label="Last Name" name="last_name" />
                  <Field label="Email" name="email" type="email" />
                  <Field label="Phone" name="phone" type="tel" />
                  <Field label="Date of Birth" name="date_of_birth" type="date" />
                  <Field label="NI Number" name="national_insurance" />
                </div>

                <p className="text-sm font-semibold pt-2">Employment</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Status" name="employment_status" />
                  <Field label="Employer" name="employer_name" />
                  <Field label="Annual Income (£)" name="annual_income" type="number" />
                </div>

                <p className="text-sm font-semibold pt-2">Emergency Contact</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" name="emergency_contact_name" />
                  <Field label="Phone" name="emergency_contact_phone" type="tel" />
                  <Field label="Relationship" name="emergency_contact_relationship" />
                </div>

                <p className="text-sm font-semibold pt-2">Guarantor</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Name" name="guarantor_name" />
                  <Field label="Email" name="guarantor_email" type="email" />
                  <Field label="Phone" name="guarantor_phone" type="tel" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Guarantor Address</Label>
                  <Textarea {...form.register('guarantor_address')} rows={2} className="text-sm" />
                </div>

                <p className="text-sm font-semibold pt-2">Previous Tenancy</p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Previous Address" name="previous_address" />
                  <Field label="Landlord Name" name="previous_landlord_name" />
                  <Field label="Landlord Phone" name="previous_landlord_phone" type="tel" />
                </div>
              </>
            )}

            {/* Compliance Contact — shared */}
            <p className="text-sm font-semibold pt-2">Compliance / Certificates Contact</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name" name="compliance_contact_name" />
              <Field label="Email" name="compliance_contact_email" type="email" />
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea {...form.register('notes')} rows={3} className="text-sm" />
            </div>
          </form>
        </ScrollArea>
        <div className="px-6 py-4 border-t flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="edit-tenant-form" disabled={updateTenant.isPending}>
            {updateTenant.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
