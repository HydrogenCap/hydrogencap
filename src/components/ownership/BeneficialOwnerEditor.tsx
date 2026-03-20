import React, { useState, useEffect } from 'react';
import { captureError } from '@/lib/sentry';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useAddBeneficialOwner,
  useUpdateBeneficialOwner,
  type BeneficialOwner,
} from '@/hooks/useBeneficialOwnership';
import { useCompanies } from '@/hooks/useCompanies';
import { useParties, useCreateParty } from '@/hooks/useParties';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  owner_type: z.enum(['COMPANY', 'PERSON']),
  company_id: z.string().optional().nullable(),
  party_id: z.string().optional().nullable(),
  beneficial_percent: z.coerce.number().min(0).max(100),
  start_date: z.string().optional().nullable(),
  end_date: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.owner_type === 'COMPANY') return !!data.company_id;
    if (data.owner_type === 'PERSON') return !!data.party_id;
    return false;
  },
  { message: 'Please select an owner', path: ['company_id'] }
);

type FormData = z.infer<typeof formSchema>;

interface BeneficialOwnerEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingOwner?: BeneficialOwner | null;
}

export function BeneficialOwnerEditor({
  propertyId,
  open,
  onOpenChange,
  editingOwner,
}: BeneficialOwnerEditorProps) {
  const { toast } = useToast();
  const addOwner = useAddBeneficialOwner();
  const updateOwner = useUpdateBeneficialOwner();
  const createParty = useCreateParty();
  const { data: companies = [] } = useCompanies();
  const { data: parties = [] } = useParties();
  
  const [ownerType, setOwnerType] = useState<'COMPANY' | 'PERSON'>('COMPANY');
  const [showNewPersonInput, setShowNewPersonInput] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      owner_type: 'COMPANY',
      company_id: null,
      party_id: null,
      beneficial_percent: 0,
      start_date: null,
      end_date: null,
      notes: null,
    },
  });

  // Reset form when dialog opens/closes or editing owner changes
  useEffect(() => {
    if (open) {
      if (editingOwner) {
        const type = editingOwner.owner_type;
        setOwnerType(type);
        form.reset({
          owner_type: type,
          company_id: editingOwner.company_id,
          party_id: editingOwner.party_id,
          beneficial_percent: Number(editingOwner.beneficial_percent),
          start_date: editingOwner.start_date,
          end_date: editingOwner.end_date,
          notes: editingOwner.notes,
        });
      } else {
        setOwnerType('COMPANY');
        form.reset({
          owner_type: 'COMPANY',
          company_id: null,
          party_id: null,
          beneficial_percent: 0,
          start_date: null,
          end_date: null,
          notes: null,
        });
      }
    }
  }, [open, editingOwner, form]);

  const handleTypeChange = (type: 'COMPANY' | 'PERSON') => {
    setOwnerType(type);
    form.setValue('owner_type', type);
    form.setValue('company_id', null);
    form.setValue('party_id', null);
    setShowNewPersonInput(false);
    setNewPersonName('');
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) return;
    try {
      const newParty = await createParty.mutateAsync({
        party_type: 'INDIVIDUAL',
        display_name: newPersonName.trim(),
      });
      form.setValue('party_id', newParty.id);
      setShowNewPersonInput(false);
      setNewPersonName('');
      toast({ title: `Created "${newParty.display_name}"` });
    } catch (err) {
      console.error('Error creating party:', err);
      toast({
        title: 'Error',
        description: 'Failed to create person',
        variant: 'destructive',
      });
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const payload = {
        property_id: propertyId,
        owner_type: data.owner_type,
        company_id: data.owner_type === 'COMPANY' ? data.company_id : null,
        party_id: data.owner_type === 'PERSON' ? data.party_id : null,
        beneficial_percent: data.beneficial_percent,
        start_date: data.start_date || null,
        end_date: data.end_date || null,
        notes: data.notes || null,
      };

      if (editingOwner) {
        await updateOwner.mutateAsync({
          id: editingOwner.id,
          ...payload,
        });
        toast({ title: 'Beneficial owner updated' });
      } else {
        await addOwner.mutateAsync(payload);
        toast({ title: 'Beneficial owner added' });
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Error saving beneficial owner:', err);
      toast({
        title: 'Error',
        description: 'Failed to save beneficial owner',
        variant: 'destructive',
      });
    }
  };

  const isLoading = addOwner.isPending || updateOwner.isPending || createParty.isPending;

  // Filter parties to show only individuals
  const individuals = parties.filter(p => p.party_type === 'INDIVIDUAL');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{editingOwner ? 'Edit' : 'Add'} Beneficial Owner</DialogTitle>
          <DialogDescription>
            Add a company or individual as a beneficial owner of this property.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Owner Type Toggle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant={ownerType === 'COMPANY' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleTypeChange('COMPANY')}
              >
                Company
              </Button>
              <Button
                type="button"
                variant={ownerType === 'PERSON' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => handleTypeChange('PERSON')}
              >
                Person
              </Button>
            </div>

            {/* Company Selector */}
            {ownerType === 'COMPANY' && (
              <FormField
                control={form.control}
                name="company_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a company..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {companies.map((company) => (
                          <SelectItem key={company.id} value={company.id}>
                            {company.legal_name}
                            <span className="text-muted-foreground ml-2">({company.company_type})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Person Selector */}
            {ownerType === 'PERSON' && (
              <FormField
                control={form.control}
                name="party_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Person</FormLabel>
                    {!showNewPersonInput ? (
                      <>
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a person..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {individuals.map((party) => (
                              <SelectItem key={party.id} value={party.id}>
                                {party.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-8 text-xs"
                          onClick={() => setShowNewPersonInput(true)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add new person
                        </Button>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="Enter person's name..."
                            value={newPersonName}
                            onChange={(e) => setNewPersonName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleCreatePerson();
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleCreatePerson}
                            disabled={!newPersonName.trim() || createParty.isPending}
                          >
                            {createParty.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              'Add'
                            )}
                          </Button>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setShowNewPersonInput(false);
                            setNewPersonName('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Percentage */}
            <FormField
              control={form.control}
              name="beneficial_percent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beneficial Ownership %</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} value={field.value ?? ''} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes..."
                      {...field}
                      value={field.value ?? ''}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingOwner ? 'Update' : 'Add'} Owner
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
