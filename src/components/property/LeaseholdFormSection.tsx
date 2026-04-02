import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Building } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { useLeaseholdDetails, useUpdateLeaseholdDetails } from '@/hooks/useLeaseholdDetails';
import { useToast } from '@/hooks/use-toast';

interface LeaseholdFormSectionProps {
  propertyId?: string;
  tenure?: string;
}

export function LeaseholdFormSection({ propertyId, tenure }: LeaseholdFormSectionProps) {
  const isLeasehold = tenure === 'Leasehold' || tenure === 'Share of Freehold';
  const { data: details, isLoading } = useLeaseholdDetails(isLeasehold && propertyId ? propertyId : undefined);
  const upsert = useUpdateLeaseholdDetails();
  const { toast } = useToast();

  if (!isLeasehold) return null;

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!propertyId) return;

    const formData = new FormData(e.currentTarget);

    try {
      await upsert.mutateAsync({
        propertyId,
        originalLeaseYears: formData.get('original_lease_years') ? parseInt(formData.get('original_lease_years') as string) : undefined,
        leaseStartDate: (formData.get('lease_start_date') as string) || undefined,
        remainingYears: formData.get('remaining_years') ? parseFloat(formData.get('remaining_years') as string) : undefined,
        groundRent: formData.get('ground_rent') ? parseFloat(formData.get('ground_rent') as string) : undefined,
        groundRentFrequency: (formData.get('ground_rent_frequency') as string) || undefined,
        groundRentReviewDate: (formData.get('ground_rent_review_date') as string) || undefined,
        groundRentEscalation: (formData.get('ground_rent_escalation') as string) || undefined,
        groundRentEscalationDetail: (formData.get('ground_rent_escalation_detail') as string) || undefined,
        serviceCharge: formData.get('service_charge') ? parseFloat(formData.get('service_charge') as string) : undefined,
        serviceChargeFrequency: (formData.get('service_charge_frequency') as string) || undefined,
        managementCompany: (formData.get('management_company') as string) || undefined,
        freeholderName: (formData.get('freeholder_name') as string) || undefined,
        freeholderContact: (formData.get('freeholder_contact') as string) || undefined,
        leaseExtensionEligible: formData.get('lease_extension_eligible') === 'on',
        estimatedExtensionCost: formData.get('estimated_extension_cost') ? parseFloat(formData.get('estimated_extension_cost') as string) : undefined,
        notes: (formData.get('leasehold_notes') as string) || undefined,
      });
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save leasehold details',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-4 w-4 text-primary" />
          Leasehold Details
        </CardTitle>
        <CardDescription>Ground rent, service charge, and lease information</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading leasehold details...</p>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {/* Lease Term */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Original Lease (years)</label>
                <Input
                  name="original_lease_years"
                  type="number"
                  min="0"
                  max="999"
                  placeholder="e.g. 125"
                  defaultValue={details?.original_lease_years ?? details?.original_term_years ?? ''}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Lease Start Date</label>
                <Input
                  name="lease_start_date"
                  type="date"
                  defaultValue={details?.lease_start_date ?? ''}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Remaining Years</label>
                <Input
                  name="remaining_years"
                  type="number"
                  min="0"
                  max="999"
                  step="0.1"
                  placeholder="e.g. 89.5"
                  defaultValue={details?.remaining_years ?? ''}
                  className="bg-input mt-1"
                />
              </div>
            </div>

            {/* Ground Rent */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Ground Rent (£)</label>
                <Input
                  name="ground_rent"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  defaultValue={details?.ground_rent ?? details?.ground_rent_annual ?? ''}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Frequency</label>
                <select
                  name="ground_rent_frequency"
                  defaultValue={details?.ground_rent_frequency ?? 'annual'}
                  className="flex h-10 w-full rounded-md border border-input bg-input px-3 py-2 text-sm mt-1"
                >
                  <option value="annual">Annual</option>
                  <option value="semi_annual">Semi-Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Review Date</label>
                <Input
                  name="ground_rent_review_date"
                  type="date"
                  defaultValue={details?.ground_rent_review_date ?? ''}
                  className="bg-input mt-1"
                />
              </div>
            </div>

            {/* Ground Rent Escalation */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Escalation Type</label>
                <select
                  name="ground_rent_escalation"
                  defaultValue={details?.ground_rent_escalation ?? ''}
                  className="flex h-10 w-full rounded-md border border-input bg-input px-3 py-2 text-sm mt-1"
                >
                  <option value="">None specified</option>
                  <option value="fixed">Fixed</option>
                  <option value="rpi">RPI-linked</option>
                  <option value="doubling">Doubling</option>
                  <option value="percentage">Percentage increase</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium">Escalation Detail</label>
                <Input
                  name="ground_rent_escalation_detail"
                  placeholder="e.g. 10% every 25 years"
                  defaultValue={details?.ground_rent_escalation_detail ?? ''}
                  className="bg-input mt-1"
                />
              </div>
            </div>

            {/* Service Charge */}
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm font-medium">Service Charge (£)</label>
                <Input
                  name="service_charge"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0"
                  defaultValue={details?.service_charge ?? details?.service_charge_annual ?? ''}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Frequency</label>
                <select
                  name="service_charge_frequency"
                  defaultValue={details?.service_charge_frequency ?? 'annual'}
                  className="flex h-10 w-full rounded-md border border-input bg-input px-3 py-2 text-sm mt-1"
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                </select>
              </div>
              <div />
            </div>

            {/* Freeholder & Management */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-medium">Freeholder Name</label>
                <Input
                  name="freeholder_name"
                  placeholder="Freeholder name"
                  defaultValue={details?.freeholder_name ?? ''}
                  className="bg-input mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Freeholder Contact</label>
                <Input
                  name="freeholder_contact"
                  placeholder="Phone, email, or address"
                  defaultValue={details?.freeholder_contact ?? ''}
                  className="bg-input mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Management Company</label>
              <Input
                name="management_company"
                placeholder="Management company name"
                defaultValue={details?.management_company ?? details?.managing_agent ?? ''}
                className="bg-input mt-1"
              />
            </div>

            {/* Extension Eligibility */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  name="lease_extension_eligible"
                  defaultChecked={details?.lease_extension_eligible ?? false}
                  className="h-4 w-4 rounded border-input"
                />
                <label className="text-sm font-medium">Eligible for Lease Extension</label>
              </div>
              <div>
                <label className="text-sm font-medium">Estimated Extension Cost (£)</label>
                <Input
                  name="estimated_extension_cost"
                  type="number"
                  min="0"
                  step="100"
                  placeholder="0"
                  defaultValue={details?.estimated_extension_cost ?? ''}
                  className="bg-input mt-1"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-sm font-medium">Leasehold Notes</label>
              <textarea
                name="leasehold_notes"
                placeholder="Any additional leasehold notes..."
                defaultValue={details?.notes ?? ''}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-input px-3 py-2 text-sm mt-1"
              />
            </div>

            <button
              type="submit"
              disabled={upsert.isPending}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-10 px-4 py-2 hover:bg-primary/90 disabled:opacity-50"
            >
              {upsert.isPending ? 'Saving...' : 'Save Leasehold Details'}
            </button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
