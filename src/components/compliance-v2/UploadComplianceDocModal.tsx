import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPLIANCE_DOC_TYPES, DOC_TYPE_DISPLAY_NAMES, type ComplianceDocType } from '@/lib/complianceV2Types';
import { useCreateComplianceDocV2 } from '@/hooks/useComplianceV2';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addMonths, format } from 'date-fns';

interface UploadComplianceDocModalProps {
  open: boolean;
  onClose: () => void;
  propertyId?: string;
  orgId: string;
  documentType?: ComplianceDocType;
  reviewFrequencyMonths?: number | null;
}

export function UploadComplianceDocModal({
  open,
  onClose,
  propertyId,
  orgId,
  documentType,
  reviewFrequencyMonths,
}: UploadComplianceDocModalProps) {
  const createDoc = useCreateComplianceDocV2();
  const [docType, setDocType] = useState<ComplianceDocType>(documentType || 'gas_safety_certificate');
  const [issueDate, setIssueDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issuerName, setIssuerName] = useState('');
  const [certificateNumber, setCertificateNumber] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  // Auto-suggest expiry when issue date changes
  const handleIssueDateChange = (val: string) => {
    setIssueDate(val);
    if (val && reviewFrequencyMonths && reviewFrequencyMonths > 0) {
      const suggested = addMonths(new Date(val), reviewFrequencyMonths);
      setExpiryDate(format(suggested, 'yyyy-MM-dd'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propertyId || !issueDate) return;
    setUploading(true);

    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;

      if (file) {
        const path = `${orgId}/${propertyId}/${docType}/${Date.now()}-${file.name}`;
        const { error: uploadErr } = await supabase.storage
          .from('compliance-documents')
          .upload(path, file);
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('compliance-documents')
          .getPublicUrl(path);
        fileUrl = urlData.publicUrl;
        fileName = file.name;
      }

      await createDoc.mutateAsync({
        org_id: orgId,
        property_id: propertyId,
        document_type: docType,
        issue_date: issueDate,
        expiry_date: expiryDate || null,
        issuer_name: issuerName || null,
        certificate_number: certificateNumber || null,
        file_url: fileUrl,
        file_name: fileName,
        cost: cost ? parseFloat(cost) : null,
        notes: notes || null,
      });

      toast.success('Compliance document added');
      resetForm();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload document';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setIssueDate('');
    setExpiryDate('');
    setIssuerName('');
    setCertificateNumber('');
    setCost('');
    setNotes('');
    setFile(null);
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Upload Compliance Document</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!documentType && (
            <div className="space-y-1.5">
              <Label>Document Type</Label>
              <Select value={docType} onValueChange={v => setDocType(v as ComplianceDocType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPLIANCE_DOC_TYPES.map(t => (
                    <SelectItem key={t} value={t}>{DOC_TYPE_DISPLAY_NAMES[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Issue Date *</Label>
              <Input type="date" value={issueDate} onChange={e => handleIssueDateChange(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date</Label>
              <Input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
              {reviewFrequencyMonths && <p className="text-[10px] text-muted-foreground">Auto-suggested from {reviewFrequencyMonths}m cycle</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Issuer / Contractor</Label>
            <Input value={issuerName} onChange={e => setIssuerName(e.target.value)} placeholder="Company or engineer name" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Certificate Number</Label>
              <Input value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cost (£)</Label>
              <Input type="number" step="0.01" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Document File</Label>
            <Input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={e => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-[10px] text-muted-foreground">PDF, JPG, PNG, WebP — max 10MB</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={uploading || !issueDate}>
              {uploading ? 'Uploading...' : 'Save Document'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
