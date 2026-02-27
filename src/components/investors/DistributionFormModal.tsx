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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCreateDistribution } from '@/hooks/useInvestorDetail';

interface CommitmentOption {
  id: string;
  entity_name: string;
  commitment_type: string;
  entity_id: string;
}

const schema = z.object({
  commitment_id: z.string().min(1, 'Commitment is required'),
  distribution_type: z.enum(['dividend', 'interest', 'loan_repayment', 'profit_share', 'capital_return', 'other']),
  amount: z.coerce.number().positive('Amount must be positive'),
  tax_deducted: z.coerce.number().min(0).default(0),
  distribution_date: z.string().min(1, 'Date is required'),
  period_from: z.string().optional().transform(v => v || null),
  period_to: z.string().optional().transform(v => v || null),
  payment_reference: z.string().optional().transform(v => v || null),
  payment_method: z.string().optional().transform(v => v || null),
  status: z.string().default('paid'),
  notes: z.string().optional().transform(v => v || null),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  investorId: string;
  commitments: CommitmentOption[];
}

const DISTRIBUTION_TYPES = [
  { value: 'dividend', label: 'Dividend' },
  { value: 'interest', label: 'Interest' },
  { value: 'loan_repayment', label: 'Loan Repayment' },
  { value: 'profit_share', label: 'Profit Share' },
  { value: 'capital_return', label: 'Capital Return' },
  { value: 'other', label: 'Other' },
];

const PAYMENT_METHODS = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'reinvested', label: 'Reinvested' },
  { value: 'offset', label: 'Offset' },
];

const STATUSES = [
  { value: 'declared', label: 'Declared' },
  { value: 'approved', label: 'Approved' },
  { value: 'paid', label: 'Paid' },
  { value: 'cancelled', label: 'Cancelled' },
];

export function DistributionFormModal({ open, onOpenChange, investorId, commitments }: Props) {
  const createDistribution = useCreateDistribution();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      commitment_id: '',
      distribution_type: 'dividend',
      amount: 0,
      tax_deducted: 0,
      distribution_date: new Date().toISOString().split('T')[0],
      period_from: '',
      period_to: '',
      payment_reference: '',
      payment_method: '',
      status: 'paid',
      notes: '',
    },
  });

  useEffect(() => {
    if (open) form.reset();
  }, [open]);

  const onSubmit = async (values: FormValues) => {
    const commitment = commitments.find(c => c.id === values.commitment_id);
    if (!commitment) return;

    await createDistribution.mutateAsync({
      investor_id: investorId,
      commitment_id: values.commitment_id,
      entity_id: commitment.entity_id,
      distribution_type: values.distribution_type,
      amount: values.amount,
      tax_deducted: values.tax_deducted,
      distribution_date: values.distribution_date,
      period_from: values.period_from,
      period_to: values.period_to,
      payment_reference: values.payment_reference,
      payment_method: values.payment_method,
      status: values.status,
      notes: values.notes,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Distribution</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="commitment_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Commitment *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Select commitment..." /></SelectTrigger></FormControl>
                  <SelectContent>
                    {commitments.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.entity_name} — {c.commitment_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="distribution_type" render={({ field }) => (
                <FormItem>
                  <FormLabel>Type *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {DISTRIBUTION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
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
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gross Amount (£) *</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="tax_deducted" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax Deducted (£)</FormLabel>
                  <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="distribution_date" render={({ field }) => (
              <FormItem>
                <FormLabel>Distribution Date *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="period_from" render={({ field }) => (
                <FormItem>
                  <FormLabel>Period From</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="period_to" render={({ field }) => (
                <FormItem>
                  <FormLabel>Period To</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="payment_reference" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Reference</FormLabel>
                  <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="payment_method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
                <FormControl><Textarea rows={2} {...field} value={field.value ?? ''} /></FormControl>
              </FormItem>
            )} />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button type="submit" disabled={createDistribution.isPending}>Record Distribution</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
