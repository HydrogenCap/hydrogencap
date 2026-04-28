import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { DocumentTemplate } from '@/lib/documentTemplates';

interface Props {
  selectedTemplate: DocumentTemplate | undefined;
  properties: Array<{ id: string; address_line_1: string; city: string }> | undefined;
  selectedPropertyId: string;
  setSelectedPropertyId: (v: string) => void;
  selectedTenancyId: string;
  setSelectedTenancyId: (v: string) => void;
  activeTenancies: Array<{ id: string; tenant_name: string | null; room_name: string | null; rent_amount_pcm: number | null }>;
  onBack: () => void;
  onNext: () => void;
}

export function ContextSelection({
  selectedTemplate, properties, selectedPropertyId, setSelectedPropertyId,
  selectedTenancyId, setSelectedTenancyId, activeTenancies, onBack, onNext,
}: Props) {
  return (
    <div className="space-y-6 max-w-lg">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
      </Button>

      <h3 className="text-lg font-semibold">{selectedTemplate?.name}</h3>

      {selectedTemplate?.legalWarning && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{selectedTemplate.legalWarning}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <div>
          <Label>Property</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger><SelectValue placeholder="Select a property" /></SelectTrigger>
            <SelectContent>
              {(properties || []).map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.address_line_1}, {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedTemplate?.requiredData.includes('tenancy') && selectedPropertyId && (
          <div>
            <Label>Tenancy</Label>
            <Select value={selectedTenancyId} onValueChange={setSelectedTenancyId}>
              <SelectTrigger><SelectValue placeholder="Select a tenancy" /></SelectTrigger>
              <SelectContent>
                {activeTenancies.map(t => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.tenant_name} — {t.room_name} (£{t.rent_amount_pcm}/m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button
          onClick={onNext}
          disabled={!selectedPropertyId || (selectedTemplate?.requiredData.includes('tenancy') && !selectedTenancyId)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
