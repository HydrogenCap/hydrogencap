import { ArrowLeft, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { SECTION_8_GROUNDS, type DocumentTemplate } from '@/lib/documentTemplates';
import type { TemplateFields } from '../utils/types';

interface Props {
  selectedTemplate: DocumentTemplate | undefined;
  selectedTemplateId: string | null;
  templateFields: TemplateFields;
  updateField: <K extends keyof TemplateFields>(key: K, value: TemplateFields[K]) => void;
  complianceChecks: { gasOk: boolean; epcOk: boolean; howToRent: boolean; depositOk: boolean } | null;
  rooms: Array<{ is_lettable: boolean }> | undefined;
  onBack: () => void;
  onGenerate: () => void;
}

export function TemplateFieldsForm({
  selectedTemplate, selectedTemplateId, templateFields, updateField,
  complianceChecks, rooms, onBack, onGenerate,
}: Props) {
  const tid = selectedTemplateId;
  return (
    <div className="space-y-6 max-w-lg">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-1" /> Back
      </Button>
      <h3 className="text-lg font-semibold">{selectedTemplate?.name} — Details</h3>

      {tid === 'section_21_notice' && (
        <div className="space-y-4">
          <div>
            <Label>Notice Date</Label>
            <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
          </div>
          <div>
            <Label>Earliest End Date</Label>
            <Input type="date" value={templateFields.earliestEndDate || ''} onChange={e => updateField('earliestEndDate', e.target.value)} />
          </div>
          {complianceChecks && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Pre-flight Checks</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className={complianceChecks.gasOk ? 'text-green-600' : 'text-destructive'}>
                  {complianceChecks.gasOk ? '☑' : '☒'} Valid Gas Safety Certificate
                </div>
                <div className={complianceChecks.epcOk ? 'text-green-600' : 'text-destructive'}>
                  {complianceChecks.epcOk ? '☑' : '☒'} Valid EPC
                </div>
                <div className={complianceChecks.howToRent ? 'text-green-600' : 'text-destructive'}>
                  {complianceChecks.howToRent ? '☑' : '☒'} How to Rent guide served
                </div>
                <div className={complianceChecks.depositOk ? 'text-green-600' : 'text-destructive'}>
                  {complianceChecks.depositOk ? '☑' : '☒'} Deposit registered
                </div>
                {!Object.values(complianceChecks).every(Boolean) && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>This Section 21 notice may not be valid.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tid === 'section_8_notice' && (
        <div className="space-y-4">
          <div>
            <Label>Notice Date</Label>
            <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
          </div>
          <div>
            <Label>Earliest Court Date</Label>
            <Input type="date" value={templateFields.earliestCourtDate || ''} onChange={e => updateField('earliestCourtDate', e.target.value)} />
          </div>
          <div>
            <Label>Grounds</Label>
            <div className="space-y-2 mt-1">
              {SECTION_8_GROUNDS.map(g => (
                <div key={g.value} className="flex items-start gap-2">
                  <Checkbox
                    checked={(templateFields.grounds || []).includes(g.value)}
                    onCheckedChange={(checked) => {
                      const curr = templateFields.grounds || [];
                      updateField('grounds', checked ? [...curr, g.value] : curr.filter((v: string) => v !== g.value));
                    }}
                  />
                  <span className="text-sm">{g.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Label>Particulars</Label>
            <Textarea
              value={templateFields.groundDetails || ''}
              onChange={e => updateField('groundDetails', e.target.value)}
              placeholder="Enter particulars of the grounds relied upon..."
            />
          </div>
        </div>
      )}

      {tid === 'section_13_rent_increase' && (
        <div className="space-y-4">
          <div>
            <Label>Notice Date</Label>
            <Input type="date" value={templateFields.noticeDate || ''} onChange={e => updateField('noticeDate', e.target.value)} />
          </div>
          <div>
            <Label>Current Rent (£/month)</Label>
            <Input type="number" value={templateFields.currentRent || ''} onChange={e => updateField('currentRent', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          <div>
            <Label>New Rent (£/month)</Label>
            <Input type="number" value={templateFields.newRent || ''} onChange={e => updateField('newRent', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
          {templateFields.currentRent > 0 && templateFields.newRent > 0 && (
            <p className="text-sm text-muted-foreground">
              Increase: {((templateFields.newRent - templateFields.currentRent) / templateFields.currentRent * 100).toFixed(1)}%
            </p>
          )}
          <div>
            <Label>Effective From</Label>
            <Input type="date" value={templateFields.increaseDate || ''} onChange={e => updateField('increaseDate', e.target.value)} />
          </div>
        </div>
      )}

      {tid === 'guarantor_agreement' && (
        <div className="space-y-4">
          <div>
            <Label>Guarantor Name</Label>
            <Input value={templateFields.guarantorName || ''} onChange={e => updateField('guarantorName', e.target.value)} />
          </div>
          <div>
            <Label>Guarantor Address</Label>
            <Input value={templateFields.guarantorAddress || ''} onChange={e => updateField('guarantorAddress', e.target.value)} />
          </div>
          <div>
            <Label>Guaranteed Amount (£)</Label>
            <Input type="number" value={templateFields.guaranteedAmount || ''} onChange={e => updateField('guaranteedAmount', e.target.value === '' ? undefined : Number(e.target.value))} />
          </div>
        </div>
      )}

      {tid === 'inventory_template' && (
        <div className="space-y-4">
          <div>
            <Label>Inspection Date</Label>
            <Input type="date" value={templateFields.date || ''} onChange={e => updateField('date', e.target.value)} />
          </div>
          <p className="text-sm text-muted-foreground">
            {(rooms || []).filter(r => r.is_lettable).length} lettable room(s) will be included.
          </p>
        </div>
      )}

      {tid === 'how_to_rent_cover' && (
        <div className="space-y-4">
          <div>
            <Label>Date Served</Label>
            <Input type="date" value={templateFields.servedDate || ''} onChange={e => updateField('servedDate', e.target.value)} />
          </div>
        </div>
      )}

      {tid === 'tenant_reference_request' && (
        <div className="space-y-4">
          <div>
            <Label>Date</Label>
            <Input type="date" value={templateFields.date || ''} onChange={e => updateField('date', e.target.value)} />
          </div>
          <div>
            <Label>Prospective Tenant Name</Label>
            <Input value={templateFields.prospectName || ''} onChange={e => updateField('prospectName', e.target.value)} />
          </div>
          <div>
            <Label>Previous Address</Label>
            <Input value={templateFields.previousAddress || ''} onChange={e => updateField('previousAddress', e.target.value)} />
          </div>
        </div>
      )}

      <Button onClick={onGenerate}>
        <Download className="h-4 w-4 mr-2" /> Generate & Download PDF
      </Button>
    </div>
  );
}
