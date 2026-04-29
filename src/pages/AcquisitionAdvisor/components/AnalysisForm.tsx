import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TEXT } from '@/lib/design-tokens';
import { Building2, Loader2, Sparkles, PoundSterling } from 'lucide-react';
import type { AcquisitionInput } from '@/hooks/useAcquisitionAnalysis';
import { PROPERTY_TYPES } from '../utils/config';

interface Props {
  form: AcquisitionInput;
  updateForm: (field: keyof AcquisitionInput, value: string | number | undefined) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function AnalysisForm({ form, updateForm, onSubmit, isPending }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className={`${TEXT.sectionHeading} flex items-center gap-2`}>
          <Building2 className="h-5 w-5 text-muted-foreground" />
          Analyse Property
        </CardTitle>
        <CardDescription>Enter details of the property you're considering</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              placeholder="123 High Street, London"
              value={form.address}
              onChange={(e) => updateForm('address', e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postcode">Postcode</Label>
            <Input
              id="postcode"
              placeholder="SW1A 1AA"
              value={form.postcode || ''}
              onChange={(e) => updateForm('postcode', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asking_price">Asking Price</Label>
            <div className="relative">
              <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="asking_price"
                type="number"
                className="pl-9"
                placeholder="250000"
                value={form.asking_price ?? ''}
                onChange={(e) =>
                  updateForm('asking_price', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="estimated_rental">Est. Monthly Rent</Label>
            <div className="relative">
              <PoundSterling className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="estimated_rental"
                type="number"
                className="pl-9"
                placeholder="1200"
                value={form.estimated_rental ?? ''}
                onChange={(e) =>
                  updateForm('estimated_rental', e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="property_type">Property Type</Label>
            <Select
              value={form.property_type || ''}
              onValueChange={(v) => updateForm('property_type', v)}
            >
              <SelectTrigger id="property_type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beds">Bedrooms</Label>
            <Input
              id="beds"
              type="number"
              min={0}
              max={20}
              placeholder="3"
              value={form.beds ?? ''}
              onChange={(e) =>
                updateForm('beds', e.target.value ? Number(e.target.value) : undefined)
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional context..."
              rows={3}
              value={form.notes || ''}
              onChange={(e) => updateForm('notes', e.target.value)}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!form.address.trim() || isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analysing...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analyse
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
