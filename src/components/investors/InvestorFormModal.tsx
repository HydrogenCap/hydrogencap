import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateInvestor, useUpdateInvestor, Investor } from '@/hooks/useInvestors';

const schema = z.object({
  investor_name: z.string().min(1, 'Name is required'),
  investor_type: z.enum(['individual', 'company', 'trust', 'family_office', 'fund', 'jv_partner']),
  email: z.string().email().optional().or(z.literal('')).transform(v => v || null),
  phone: z.string().optional().transform(v => v || null),
  company_name: z.string().optional().transform(v => v || null),
  contact_person: z.string().optional().transform(v => v || null),
  address: z.string().optional().transform(v => v || null),
  tax_residency: z.string().optional().transform(v => v || null),
  preferred_currency: z.string().optional().transform(v => v || null),
  accredited_investor: z.boolean().default(false),
  kyc_completed: z.boolean().default(false),
  kyc_completed_date: z.string().optional().transform(v => v || null),
  risk_profile: z.string().optional().transform(v => v || null),
  communication_preference: z.string().default('email'),
  portal_access_enabled: z.boolean().default(false),
  notes: z.string().optional().transform(v => v || null),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investor?: Investor | null;
}

const INVESTOR_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'company', label: 'Company' },
  { value: 'trust', label: 'Trust' },
  { value: 'family_office', label: 'Family Office' },
  { value: 'fund', label: 'Fund' },
  { value: 'jv_partner', label: 'JV Partner' },
];

const RISK_PROFILES = [
  { value: 'conservative', label: 'Conservative' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'aggressive', label: 'Aggressive' },
];

const COMM_PREFS = [
  { value: 'email', label: 'Email' },
  { value: 'portal_only', label: 'Portal Only' },
  { value: 'email_and_portal', label: 'Email & Portal' },
];

const CURRENCIES = ['GBP', 'USD', 'EUR'];

export function InvestorFormModal({ open, onOpenChange, investor }: Props) {
  const createInvestor = useCreateInvestor();
  const updateInvestor = useUpdateInvestor();
  const isEditing = !!investor;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      investor_name: '',
      investor_type: 'individual',
      email: '',
      phone: '',
      company_name: '',
      contact_person: '',
      address: '',
      tax_residency: 'UK',
      preferred_currency: 'GBP',
      accredited_investor: false,
      kyc_completed: false,
      kyc_completed_date: '',
      risk_profile: '',
      communication_preference: 'email',
      portal_access_enabled: false,
      notes: '',
    },
  });

  const investorType = form.watch('investor_type');
  const showCompanyFields = ['company', 'fund', 'family_office'].includes(investorType);

  useEffect(() => {
    if (investor) {
      form.reset({
        investor_name: investor.investor_name,
        investor_type: investor.investor_type as FormValues['investor_type'],
        email: investor.email || '',
        phone: investor.phone || '',
        company_name: investor.company_name || '',
        contact_person: investor.contact_person || '',
        address: investor.address || '',
        tax_residency: investor.tax_residency || 'UK',
        preferred_currency: investor.preferred_currency || 'GBP',
        accredited_investor: investor.accredited_investor || false,
        kyc_completed: investor.kyc_completed || false,
        kyc_completed_date: investor.kyc_completed_date || '',
        risk_profile: investor.risk_profile || '',
        communication_preference: investor.communication_preference || 'email',
        portal_access_enabled: investor.portal_access_enabled || false,
        notes: investor.notes || '',
      });
    } else {
      form.reset();
    }
  }, [investor, open, form]);

  const onSubmit = async (values: FormValues) => {
    if (isEditing) {
      await updateInvestor.mutateAsync({ id: investor.id, data: values });
    } else {
      await createInvestor.mutateAsync(values);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Investor' : 'Add Investor'}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Details */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Personal Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="investor_name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor Name *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="investor_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Investor Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {INVESTOR_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} value={field.value ?? ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                  </FormItem>
                )} />
              </div>
              {showCompanyFields && (
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="company_name" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Company Name</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="contact_person" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Person</FormLabel>
                      <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              )}
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            {/* Investment Profile */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Investment Profile</h4>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="tax_residency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax Residency</FormLabel>
                    <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="preferred_currency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? 'GBP'}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="risk_profile" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Risk Profile</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {RISK_PROFILES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="accredited_investor" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Accredited Investor</FormLabel>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* KYC */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">KYC</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="kyc_completed" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>KYC Completed</FormLabel>
                  </FormItem>
                )} />
                <FormField control={form.control} name="kyc_completed_date" render={({ field }) => (
                  <FormItem>
                    <FormLabel>KYC Date</FormLabel>
                    <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Communication */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Communication</h4>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="communication_preference" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Communication Preference</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {COMM_PREFS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="portal_access_enabled" render={({ field }) => (
                  <FormItem className="flex items-center gap-3 space-y-0 pt-6">
                    <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    <FormLabel>Portal Access Enabled</FormLabel>
                  </FormItem>
                )} />
              </div>
            </div>

            {/* Notes */}
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={3} {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createInvestor.isPending || updateInvestor.isPending}>
                {isEditing ? 'Save Changes' : 'Add Investor'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
