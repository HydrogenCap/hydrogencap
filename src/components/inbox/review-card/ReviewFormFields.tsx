import { format } from 'date-fns';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import type { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];

interface Property {
  id: string;
  address_line_1: string;
  city: string;
  postcode: string;
}

interface Props {
  document: Document;
  properties: Property[] | undefined;
  selectedDocType: string;
  setSelectedDocType: (v: string) => void;
  selectedPropertyId: string;
  setSelectedPropertyId: (v: string) => void;
  issueDate: string;
  setIssueDate: (v: string) => void;
  expiryDate: string;
  setExpiryDate: (v: string) => void;
  docTypeConfidence: number;
  propertyConfidence: number;
  suggestedProperty: Property | undefined;
}

export function ReviewFormFields(p: Props) {
  const { document } = p;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Compliance Type</label>
        <Select value={p.selectedDocType} onValueChange={p.setSelectedDocType}>
          <SelectTrigger>
            <SelectValue placeholder="Select compliance type" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(COMPLIANCE_DOC_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {document.ai_suggested_doc_type && (
          <p className="text-xs text-muted-foreground">
            AI detected: {COMPLIANCE_DOC_TYPE_LABELS[document.ai_suggested_doc_type]}
            ({Math.round(p.docTypeConfidence * 100)}%)
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">
          Property {!p.selectedPropertyId && <span className="text-amber-500">*</span>}
        </label>
        <Select value={p.selectedPropertyId} onValueChange={p.setSelectedPropertyId}>
          <SelectTrigger className={!p.selectedPropertyId ? 'border-amber-500' : ''}>
            <SelectValue placeholder="Select property..." />
          </SelectTrigger>
          <SelectContent>
            {p.properties?.map((property) => (
              <SelectItem key={property.id} value={property.id}>
                {property.address_line_1}, {property.city} {property.postcode}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {document.ai_suggested_property_id && p.suggestedProperty && (
          <p className="text-xs text-muted-foreground">
            AI matched: {p.suggestedProperty.address_line_1}
            ({Math.round(p.propertyConfidence * 100)}%)
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Issue Date</label>
        <Input
          type="date"
          value={p.issueDate}
          onChange={(e) => p.setIssueDate(e.target.value)}
        />
        {document.extracted_issue_date && (
          <p className="text-xs text-muted-foreground">
            AI detected: {format(new Date(document.extracted_issue_date), 'dd MMM yyyy')}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground">Expiry Date</label>
        <Input
          type="date"
          value={p.expiryDate}
          onChange={(e) => p.setExpiryDate(e.target.value)}
        />
        {document.expiry_date && document.expiry_date !== p.expiryDate && (
          <p className="text-xs text-muted-foreground">
            AI detected: {format(new Date(document.expiry_date), 'dd MMM yyyy')}
          </p>
        )}
      </div>

      {(document.extracted_address_text || document.extracted_reference_number || document.extracted_epc_rating) && (
        <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg space-y-2">
          <p className="text-sm font-medium text-foreground flex items-center gap-1">
            <AlertCircle className="h-4 w-4" />
            AI Extracted Information
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {document.extracted_address_text && (
              <div>
                <span className="text-muted-foreground">Address:</span>
                <p className="font-medium">{document.extracted_address_text}</p>
              </div>
            )}
            {document.extracted_reference_number && (
              <div>
                <span className="text-muted-foreground">Reference:</span>
                <p className="font-medium">{document.extracted_reference_number}</p>
              </div>
            )}
            {document.extracted_epc_rating && (
              <div>
                <span className="text-muted-foreground">EPC Rating:</span>
                <p className="font-medium">{document.extracted_epc_rating}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
