import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useCreateDeal,
  LISTING_SOURCE_LABELS,
  type ListingSource,
  type DealPipelineInsert,
} from '@/hooks/useDealPipeline';

const PROPERTY_TYPES = [
  'Terraced',
  'Semi-detached',
  'Detached',
  'Flat',
  'Maisonette',
  'Bungalow',
  'HMO',
  'Commercial',
  'Mixed-use',
  'Land',
  'Other',
];

interface DealSourcingFormProps {
  onSuccess?: () => void;
}

export function DealSourcingForm({ onSuccess }: DealSourcingFormProps) {
  const createDeal = useCreateDeal();
  const [form, setForm] = useState<Partial<DealPipelineInsert>>({});

  const set = <K extends keyof DealPipelineInsert>(key: K, value: DealPipelineInsert[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.address) return;

    // Auto-calculate yield if we have asking price and rental
    let estimatedYield = form.estimated_yield;
    if (!estimatedYield && form.asking_price && form.estimated_rental) {
      estimatedYield = Number(
        (((form.estimated_rental * 12) / form.asking_price) * 100).toFixed(2)
      );
    }

    createDeal.mutate(
      { ...form, address: form.address, estimated_yield: estimatedYield },
      {
        onSuccess: () => {
          setForm({});
          onSuccess?.();
        },
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Listing URL */}
      <div>
        <Label>Listing URL</Label>
        <Input
          placeholder="https://www.rightmove.co.uk/..."
          value={form.listing_url || ''}
          onChange={e => set('listing_url', e.target.value)}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Rightmove, Zoopla, OnTheMarket link
        </p>
      </div>

      {/* Address + Postcode */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label>Address *</Label>
          <Input
            required
            placeholder="123 High Street, Manchester"
            value={form.address || ''}
            onChange={e => set('address', e.target.value)}
          />
        </div>
        <div>
          <Label>Postcode</Label>
          <Input
            placeholder="M1 2AB"
            value={form.postcode || ''}
            onChange={e => set('postcode', e.target.value)}
          />
        </div>
      </div>

      {/* Source + Property Type + Beds */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Source</Label>
          <Select
            value={form.listing_source || ''}
            onValueChange={v => set('listing_source', v as ListingSource)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select source" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LISTING_SOURCE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Property Type</Label>
          <Select
            value={form.property_type || ''}
            onValueChange={v => set('property_type', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {PROPERTY_TYPES.map(t => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Beds</Label>
          <Input
            type="number"
            min={0}
            placeholder="3"
            value={form.beds ?? ''}
            onChange={e => set('beds', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Financials */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label>Asking Price (£)</Label>
          <Input
            type="number"
            min={0}
            placeholder="250000"
            value={form.asking_price ?? ''}
            onChange={e => set('asking_price', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label>Est. Monthly Rent (£)</Label>
          <Input
            type="number"
            min={0}
            placeholder="1200"
            value={form.estimated_rental ?? ''}
            onChange={e => set('estimated_rental', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
        <div>
          <Label>Est. Refurb (£)</Label>
          <Input
            type="number"
            min={0}
            placeholder="15000"
            value={form.estimated_refurb ?? ''}
            onChange={e => set('estimated_refurb', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </div>

      {/* Yield preview */}
      {form.asking_price && form.estimated_rental ? (
        <div className="text-sm text-muted-foreground bg-muted/50 rounded-md p-2">
          Gross Yield:{' '}
          <span className="font-medium text-foreground">
            {(((form.estimated_rental * 12) / form.asking_price) * 100).toFixed(2)}%
          </span>
        </div>
      ) : null}

      {/* Agent details */}
      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-3">Agent Contact (optional)</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Agent Name</Label>
            <Input
              placeholder="John Smith"
              value={form.agent_name || ''}
              onChange={e => set('agent_name', e.target.value)}
            />
          </div>
          <div>
            <Label>Company</Label>
            <Input
              placeholder="Purple Bricks"
              value={form.agent_company || ''}
              onChange={e => set('agent_company', e.target.value)}
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              placeholder="07700 900000"
              value={form.agent_phone || ''}
              onChange={e => set('agent_phone', e.target.value)}
            />
          </div>
          <div>
            <Label>Email</Label>
            <Input
              type="email"
              placeholder="agent@example.com"
              value={form.agent_email || ''}
              onChange={e => set('agent_email', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label>Notes</Label>
        <Textarea
          placeholder="Any additional notes about this deal..."
          value={form.notes || ''}
          onChange={e => set('notes', e.target.value)}
          rows={3}
        />
      </div>

      <Button type="submit" className="w-full" disabled={createDeal.isPending || !form.address}>
        {createDeal.isPending ? 'Adding...' : 'Add to Pipeline'}
      </Button>
    </form>
  );
}
