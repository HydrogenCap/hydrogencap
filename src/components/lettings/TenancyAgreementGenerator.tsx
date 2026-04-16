import { useState, useRef } from 'react';
import { format } from 'date-fns';
import { sanitizeHtml } from '@/lib/sanitizeHtml';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileText, Download, Send, Eye, EyeOff } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import {
  useTenancyDraft,
  useSaveTenancyDraft,
  useUpdateTenancyDraft,
  type TenancyAgreementDraft,
} from '@/hooks/useLettingsWorkflow';
import { useToast } from '@/hooks/use-toast';
import type { LettingsPipelineItem } from '@/hooks/useLettingsPipeline';

function generateAgreementHtml(d: Omit<TenancyAgreementDraft, 'id' | 'org_id' | 'created_at' | 'agreement_html'>): string {
  const depositWeeks = d.deposit_amount && d.rent_amount
    ? ((d.deposit_amount / (d.rent_amount * 12)) * 52).toFixed(1)
    : '—';

  return `
    <div style="font-family: 'Times New Roman', serif; max-width: 700px; margin: 0 auto; padding: 40px; line-height: 1.6;">
      <h1 style="text-align: center; font-size: 22px; border-bottom: 2px solid #333; padding-bottom: 12px;">
        ASSURED SHORTHOLD TENANCY AGREEMENT
      </h1>

      <h2 style="font-size: 16px; margin-top: 24px;">PARTIES</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; width: 30%; font-weight: bold;">Landlord</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.landlord_name}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Landlord Address</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.landlord_address || '—'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Tenant(s)</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.tenant_names}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Tenant Address</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.tenant_address || '—'}</td>
        </tr>
      </table>

      <h2 style="font-size: 16px; margin-top: 24px;">PROPERTY</h2>
      <p style="font-size: 14px;"><strong>Address:</strong> ${d.property_address}</p>
      ${d.property_description ? `<p style="font-size: 14px;"><strong>Description:</strong> ${d.property_description}</p>` : ''}

      <h2 style="font-size: 16px; margin-top: 24px;">TENANCY TERMS</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; width: 30%; font-weight: bold;">Start Date</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.tenancy_start_date ? format(new Date(d.tenancy_start_date), 'dd MMMM yyyy') : '—'}</td>
        </tr>
        ${d.tenancy_end_date ? `
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">End Date</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${format(new Date(d.tenancy_end_date), 'dd MMMM yyyy')}</td>
        </tr>` : ''}
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Rent</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">£${d.rent_amount.toFixed(2)} ${d.payment_frequency}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Payment Day</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">${d.payment_day ? `${d.payment_day}${getOrdinal(d.payment_day)} of each month` : '—'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Deposit</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">£${d.deposit_amount?.toFixed(2) || '—'} (${depositWeeks} weeks' rent)</td>
        </tr>
        ${d.break_clause_months ? `
        <tr>
          <td style="padding: 6px 12px; border: 1px solid #ccc; font-weight: bold;">Break Clause</td>
          <td style="padding: 6px 12px; border: 1px solid #ccc;">Either party may terminate after ${d.break_clause_months} months with 2 months' written notice</td>
        </tr>` : ''}
      </table>

      ${d.special_conditions ? `
      <h2 style="font-size: 16px; margin-top: 24px;">SPECIAL CONDITIONS</h2>
      <p style="font-size: 14px; white-space: pre-wrap;">${d.special_conditions}</p>` : ''}

      <div style="margin-top: 48px; font-size: 14px;">
        <div style="display: flex; justify-content: space-between; margin-top: 40px;">
          <div>
            <p><strong>Landlord Signature:</strong></p>
            <div style="border-bottom: 1px solid #333; width: 250px; height: 40px;"></div>
            <p style="margin-top: 4px;">Date: _______________</p>
          </div>
          <div>
            <p><strong>Tenant Signature:</strong></p>
            <div style="border-bottom: 1px solid #333; width: 250px; height: 40px;"></div>
            <p style="margin-top: 4px;">Date: _______________</p>
          </div>
        </div>
      </div>
    </div>
  `;
}

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function calculateMaxDeposit(annualRent: number): number {
  // Max 5 weeks for annual rent under £50k
  if (annualRent < 50000) return (annualRent / 52) * 5;
  return (annualRent / 52) * 6;
}

interface TenancyAgreementGeneratorProps {
  item: LettingsPipelineItem;
}

export function TenancyAgreementGenerator({ item }: TenancyAgreementGeneratorProps) {
  const { data: existingDraft, isLoading } = useTenancyDraft(item.id);
  const saveDraft = useSaveTenancyDraft();
  const updateDraft = useUpdateTenancyDraft();
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const [showPreview, setShowPreview] = useState(false);

  const monthlyRent = item.offered_rent || item.advertised_rent || 0;
  const annualRent = monthlyRent * 12;
  const maxDeposit = calculateMaxDeposit(annualRent);
  const propertyAddress = item.property ? `${item.property.address_line_1}, ${item.property.postcode}` : '';

  const [form, setForm] = useState({
    tenant_names: existingDraft?.tenant_names || item.offered_to_name || '',
    tenant_address: existingDraft?.tenant_address || '',
    landlord_name: existingDraft?.landlord_name || '',
    landlord_address: existingDraft?.landlord_address || '',
    property_address: existingDraft?.property_address || propertyAddress,
    property_description: existingDraft?.property_description || (item.room?.room_name ? `${item.room.room_name}` : ''),
    rent_amount: existingDraft?.rent_amount || monthlyRent,
    payment_frequency: existingDraft?.payment_frequency || 'monthly',
    payment_day: existingDraft?.payment_day || 1,
    deposit_amount: existingDraft?.deposit_amount || Math.min(monthlyRent * 5 / 4.33, maxDeposit),
    tenancy_start_date: existingDraft?.tenancy_start_date || item.target_move_in || '',
    tenancy_end_date: existingDraft?.tenancy_end_date || '',
    break_clause_months: existingDraft?.break_clause_months || null as number | null,
    special_conditions: existingDraft?.special_conditions || '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [key]: value }));

  const html = generateAgreementHtml({
    ...form,
    letting_id: item.id,
    property_id: item.property_id,
    status: existingDraft?.status || 'draft',
  });

  const handleSave = () => {
    if (existingDraft) {
      updateDraft.mutate({
        id: existingDraft.id,
        lettingId: item.id,
        ...form,
        agreement_html: html,
      });
    } else {
      saveDraft.mutate({
        ...form,
        letting_id: item.id,
        property_id: item.property_id,
        agreement_html: html,
        status: 'draft',
      });
    }
  };

  const handleDownloadPdf = () => {
    // Use jsPDF to render the agreement as PDF
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      const maxWidth = pageWidth - margin * 2;
      let y = 20;

      doc.setFont('times', 'bold');
      doc.setFontSize(18);
      doc.text('ASSURED SHORTHOLD TENANCY AGREEMENT', pageWidth / 2, y, { align: 'center' });
      y += 12;
      doc.setDrawColor(51, 51, 51);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      const addSection = (title: string) => {
        if (y > 260) { doc.addPage(); y = 20; }
        doc.setFont('times', 'bold');
        doc.setFontSize(14);
        doc.text(title, margin, y);
        y += 8;
      };

      const addRow = (label: string, value: string) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont('times', 'bold');
        doc.setFontSize(11);
        doc.text(`${label}:`, margin, y);
        doc.setFont('times', 'normal');
        doc.text(value || '—', margin + 50, y);
        y += 7;
      };

      addSection('PARTIES');
      addRow('Landlord', form.landlord_name);
      addRow('Address', form.landlord_address);
      addRow('Tenant(s)', form.tenant_names);
      addRow('Address', form.tenant_address);
      y += 4;

      addSection('PROPERTY');
      addRow('Address', form.property_address);
      if (form.property_description) addRow('Description', form.property_description);
      y += 4;

      addSection('TENANCY TERMS');
      addRow('Start Date', form.tenancy_start_date ? format(new Date(form.tenancy_start_date), 'dd MMMM yyyy') : '—');
      if (form.tenancy_end_date) addRow('End Date', format(new Date(form.tenancy_end_date), 'dd MMMM yyyy'));
      addRow('Rent', `£${form.rent_amount.toFixed(2)} ${form.payment_frequency}`);
      addRow('Payment Day', form.payment_day ? `${form.payment_day}${getOrdinal(form.payment_day)} of each month` : '—');
      addRow('Deposit', `£${form.deposit_amount?.toFixed(2) || '—'}`);
      if (form.break_clause_months) addRow('Break Clause', `${form.break_clause_months} months`);
      y += 4;

      if (form.special_conditions) {
        addSection('SPECIAL CONDITIONS');
        doc.setFont('times', 'normal');
        doc.setFontSize(11);
        const lines = doc.splitTextToSize(form.special_conditions, maxWidth);
        doc.text(lines, margin, y);
        y += lines.length * 6;
      }

      y += 20;
      if (y > 240) { doc.addPage(); y = 20; }
      doc.setFont('times', 'bold');
      doc.setFontSize(11);
      doc.text('Landlord Signature: ________________________', margin, y);
      doc.text('Date: __________', margin + 110, y);
      y += 15;
      doc.text('Tenant Signature: ________________________', margin, y);
      doc.text('Date: __________', margin + 110, y);

      doc.save(`tenancy-agreement-${form.tenant_names.replace(/\s+/g, '-').toLowerCase()}.pdf`);
      toast({ title: 'PDF downloaded' });
    });
  };

  const handleSendForSigning = () => {
    if (existingDraft) {
      updateDraft.mutate({
        id: existingDraft.id,
        lettingId: item.id,
        status: 'sent_for_signing',
      });
    }
    toast({ title: 'Agreement sent for signing', description: 'E-signature integration coming soon' });
  };

  if (isLoading) return <p className="text-sm text-muted-foreground py-4">Loading agreement…</p>;

  const depositExceedsMax = form.deposit_amount && form.deposit_amount > maxDeposit;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Tenancy Agreement
        </h3>
        {existingDraft && <Badge variant={existingDraft.status === 'draft' ? 'outline' : existingDraft.status === 'signed' ? 'default' : 'secondary'}>{existingDraft.status}</Badge>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Landlord Name</Label>
          <Input value={form.landlord_name} onChange={e => set('landlord_name', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Landlord Address</Label>
          <Input value={form.landlord_address} onChange={e => set('landlord_address', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tenant Name(s)</Label>
          <Input value={form.tenant_names} onChange={e => set('tenant_names', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Tenant Current Address</Label>
          <Input value={form.tenant_address} onChange={e => set('tenant_address', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Property Address</Label>
          <Input value={form.property_address} onChange={e => set('property_address', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Property Description</Label>
          <Input value={form.property_description} onChange={e => set('property_description', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Rent Amount (£)</Label>
          <Input type="number" value={form.rent_amount} onChange={e => set('rent_amount', Number(e.target.value))} />
        </div>
        <div>
          <Label className="text-xs">Frequency</Label>
          <Select value={form.payment_frequency} onValueChange={v => set('payment_frequency', v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Payment Day</Label>
          <Input type="number" min={1} max={31} value={form.payment_day ?? ''} onChange={e => set('payment_day', Number(e.target.value))} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Deposit (£)</Label>
          <Input type="number" value={form.deposit_amount ?? ''} onChange={e => set('deposit_amount', Number(e.target.value))} />
          {depositExceedsMax && (
            <p className="text-xs text-orange-600 mt-1">
              Max deposit for {formatGBP(annualRent)}/yr: {formatGBP(maxDeposit)} (5 weeks)
            </p>
          )}
        </div>
        <div>
          <Label className="text-xs">Tenancy Start Date</Label>
          <Input type="date" value={form.tenancy_start_date} onChange={e => set('tenancy_start_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">End Date (optional)</Label>
          <Input type="date" value={form.tenancy_end_date ?? ''} onChange={e => set('tenancy_end_date', e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Break Clause (months)</Label>
          <Input type="number" min={0} value={form.break_clause_months ?? ''} onChange={e => set('break_clause_months', e.target.value ? Number(e.target.value) : null)} />
        </div>
      </div>

      <div>
        <Label className="text-xs">Special Conditions</Label>
        <Textarea
          value={form.special_conditions}
          onChange={e => set('special_conditions', e.target.value)}
          placeholder="Any additional terms or conditions…"
          rows={3}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={handleSave} disabled={saveDraft.isPending || updateDraft.isPending || !form.landlord_name || !form.tenant_names}>
          <FileText className="h-4 w-4 mr-1" />
          {existingDraft ? 'Update Agreement' : 'Save Agreement'}
        </Button>
        <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
          {showPreview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {showPreview ? 'Hide Preview' : 'Preview'}
        </Button>
        <Button variant="outline" onClick={handleDownloadPdf} disabled={!form.landlord_name || !form.tenant_names}>
          <Download className="h-4 w-4 mr-1" /> Download PDF
        </Button>
        {existingDraft && existingDraft.status === 'draft' && (
          <Button variant="secondary" onClick={handleSendForSigning}>
            <Send className="h-4 w-4 mr-1" /> Send for Signing
          </Button>
        )}
      </div>

      {/* Preview */}
      {showPreview && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              ref={previewRef}
              className="border rounded-lg p-4 bg-white text-black overflow-auto max-h-[600px]"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
