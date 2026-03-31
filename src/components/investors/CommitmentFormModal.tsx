import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateCommitment } from '@/hooks/useInvestorDetail';
import { useLegalEntities } from '@/hooks/useLegalEntities';

const schema = z.object({
  entity_id: z.string().min(1, 'Entity is required'),
  commitment_type: z.enum(['equity', 'loan', 'convertible_loan', 'preference_shares', 'mezzanine']),
  committed_amount: z.coerce.number().positive('Amount must be positive'),
  drawn_amount: z.coerce.number().min(0),
  equity_percentage: z.union([z.coerce.number().min(0).max(100), z.literal('')]).optional().transform(v => v === '' ? null : v),
  commitment_date: z.string().min(1, 'Date is required'),
  maturity_date: z.string().optional().transform(v => v || null),
  coupon_rate: z.union([z.coerce.number().min(0), z.literal('')]).optional().transform(v => v === '' ? null : v),
  payment_frequency: z.string().optional().transform(v => v || null),
  status: z.string().default('active'),
  documentation_url: z.string().optional().transform(v => v || null),
  notes: z.string().optional().transform(v => v || null),
});

type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorId: string;
}

const COMMITMENT_TYPES = [
  { value: 'equity', label: 'Equity' },
  { value: 'loan', label: 'Loan' },
  { value: 'convertible_loan', label: 'Convertible Loan' },
  { value: 'preference_shares', label: 'Preference Shares' },
  { value: 'mezzanine', label: 'Mezzanine' },
];

const FREQUENCIES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'semi_annual', label: 'Semi-Annual' },
  { value: 'annual', label: 'Annual' },
  { value: 'on_maturity', label: 'On Maturity' },
];

const STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'fully_drawn', label: 'Fully Drawn' },
  { value: 'partially_returned', label: 'Partially Returned' },
  { value: 'fully_returned', label: 'Fully Returned' },
  { value: 'defaulted', label: 'Defaulted' },
];

export function CommitmentFormModal({ open, onOpenChange, investorId }: Props) {
  const createCommitment = useCreateCommitment();
  const { data: entities } = useLegalEntities();

  const form = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      entity_id: '',
      commitment_type: 'equity' as const,
      committed_amount: '' as unknown as number,
      drawn_amount: '' as unknown as number,
      equity_percentage: '',
      commitment_date: new Date().toISOString().split('T')[0],
      maturity_date: '',
      coupon_rate: '',
      payment_frequency: '',
      status: 'active',
      documentation_url: '',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) form.reset();
  }, [open, form]);

  const commitmentType = form.watch('commitment_type');
  const showEquity = commitmentType === 'equity';
  const showLoanFields = ['loan', 'convertible_loan', 'preference_shares', 'mezzanine'].includes(commitmentType);

  const onSubmit = async (values: FormValues) => {
    await createCommitment.mutateAsync({
      investor_id: investorId,
      entity_id: values.entity_id,
      commitment_type: values.commitment_type,
      committed_amount: values.committed_amount,
      drawn_amount: values.drawn_amount,
      equity_percentage: values.equity_percentage as number | null,
      commitment_date: values.commitment_date,
      maturity_date: values.maturity_date,
      coupon_rate: values.coupon_rate as number | null,
      payment_frequency: values.payment_frequency,
      status: values.status,
      documentation_url: values.documentation_url,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Commitment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="entity_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Entity *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select entity..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {entities?.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="commitment_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {COMMITMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="committed_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Committed Amount (£) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} value={field.value as string | number ?? ''} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="drawn_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Drawn Amount (£) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} value={field.value as string | number ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            {showEquity && (
              <FormField control={form.control} name="equity_percentage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Equity Percentage (%)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} value={field.value as string | number ?? ''} /></FormControl>
                  <FormDescription>This investor's percentage ownership of the entity</FormDescription>
                </FormItem>
              )} />
            )}

            <FormField control={form.control} name="commitment_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Commitment Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            {showLoanFields && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="maturity_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maturity Date</FormLabel>
                      <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="coupon_rate" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Coupon Rate (%)</FormLabel>
                      <FormControl><Input type="number" step="0.001" {...field} value={field.value ?? ''} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="payment_frequency" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ''}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {FREQUENCIES.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
              </>
            )}

            <FormField control={form.control} name="documentation_url" render={({ field }) => (
              <FormItem>
                <FormLabel>Documentation URL</FormLabel>
                <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createCommitment.isPending}>Add Commitment</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
