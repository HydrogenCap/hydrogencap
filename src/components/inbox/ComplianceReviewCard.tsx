import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { 
  FileText, MapPin, Calendar, Check, X, ChevronDown, 
  AlertCircle, Loader2, Shield, Building2, User, Edit2 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useProperties } from '@/hooks/useProperties';
import { useAcceptComplianceDocument, useRejectComplianceDocument, COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import { getComplianceItemStatus, getComplianceStatusColor } from '@/lib/complianceTypes';
import type { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];

interface ComplianceReviewCardProps {
  document: Document;
}

export function ComplianceReviewCard({ document }: ComplianceReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form state
  const [selectedDocType, setSelectedDocType] = useState(document.ai_suggested_doc_type || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState(document.ai_suggested_property_id || '');
  const [issueDate, setIssueDate] = useState(document.extracted_issue_date || '');
  const [expiryDate, setExpiryDate] = useState(document.expiry_date || '');
  
  const acceptDocument = useAcceptComplianceDocument();
  const rejectDocument = useRejectComplianceDocument();
  const { data: properties } = useProperties();

  const isProcessed = document.extraction_status === 'completed';
  const isPending = document.extraction_status === 'pending' || document.extraction_status === 'processing';
  const isProcessing = acceptDocument.isPending || rejectDocument.isPending;

  const docTypeConfidence = document.ai_doc_type_confidence || 0;
  const propertyConfidence = document.ai_property_confidence || 0;

  // Track if user has edited AI suggestions
  const wasEdited = 
    selectedDocType !== document.ai_suggested_doc_type ||
    selectedPropertyId !== document.ai_suggested_property_id ||
    issueDate !== (document.extracted_issue_date || '') ||
    expiryDate !== (document.expiry_date || '');

  // Auto-expand if low confidence
  useEffect(() => {
    if (isProcessed && (docTypeConfidence < 0.7 || propertyConfidence < 0.7 || !document.ai_suggested_property_id)) {
      setIsExpanded(true);
    }
  }, [isProcessed, docTypeConfidence, propertyConfidence, document.ai_suggested_property_id]);

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">High</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Low</Badge>;
  };

  const handleAccept = async () => {
    if (!selectedDocType) {
      return;
    }
    if (!selectedPropertyId) {
      setIsExpanded(true);
      return;
    }

    const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
    if (!selectedProperty) return;

    await acceptDocument.mutateAsync({
      documentId: document.id,
      docType: selectedDocType,
      propertyId: selectedPropertyId,
      propertyAddress: selectedProperty.address_line,
      issueDate: issueDate || null,
      expiryDate: expiryDate || null,
      originalFilename: document.original_file_name,
      fileUrl: document.file_url,
      epcRating: document.extracted_epc_rating,
      wasEdited,
      originalAiSuggestions: {
        docType: document.ai_suggested_doc_type,
        propertyId: document.ai_suggested_property_id,
        issueDate: document.extracted_issue_date,
        expiryDate: document.expiry_date,
      },
    });
  };

  const handleReject = async () => {
    await rejectDocument.mutateAsync(document.id);
  };

  const suggestedProperty = properties?.find(p => p.id === document.ai_suggested_property_id);
  const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
  
  // Calculate compliance status based on expiry
  const complianceStatus = expiryDate ? getComplianceItemStatus(expiryDate) : 'unknown';

  // Check if ready for one-click confirm
  const isReadyForConfirm = isProcessed && 
    docTypeConfidence >= 0.7 && 
    propertyConfidence >= 0.7 && 
    selectedPropertyId;

  return (
    <Card className={`bg-card border-border ${!selectedPropertyId && isProcessed ? 'border-amber-500/50' : ''}`}>
      <CardContent className="p-4">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-start gap-4">
            {/* Thumbnail */}
            <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {document.file_url && (document.original_file_name?.endsWith('.pdf') ? (
                <FileText className="h-8 w-8 text-muted-foreground" />
              ) : (
                <img 
                  src={document.file_url} 
                  alt="Document preview" 
                  className="h-full w-full object-cover"
                />
              ))}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <p className="font-medium text-foreground truncate">
                  {COMPLIANCE_DOC_TYPE_LABELS[selectedDocType] || document.original_file_name}
                </p>
                {isPending && (
                  <Badge variant="outline" className="shrink-0">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Analysing
                  </Badge>
                )}
              </div>

              {isProcessed && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {!selectedPropertyId ? (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Property match required
                    </Badge>
                  ) : (
                    <>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {selectedProperty?.address_line.split(',')[0]}
                      </span>
                      {getConfidenceBadge(propertyConfidence)}
                    </>
                  )}

                  {expiryDate && (
                    <Badge className={getComplianceStatusColor(complianceStatus)}>
                      <Calendar className="h-3 w-3 mr-1" />
                      {complianceStatus === 'expired' 
                        ? `Expired ${format(new Date(expiryDate), 'dd MMM yyyy')}`
                        : `Expires ${format(new Date(expiryDate), 'dd MMM yyyy')}`
                      }
                    </Badge>
                  )}

                  {wasEdited && (
                    <Badge variant="outline" className="text-xs">
                      <Edit2 className="h-3 w-3 mr-1" />
                      Edited
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon">
                  <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              
              <Button 
                size="icon" 
                variant="ghost" 
                className="text-destructive hover:text-destructive"
                onClick={handleReject}
                disabled={isProcessing}
              >
                <X className="h-4 w-4" />
              </Button>
              
              <Button 
                onClick={handleAccept}
                disabled={isProcessing || !isProcessed || !selectedDocType}
                className={isReadyForConfirm ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    {isReadyForConfirm ? 'Confirm' : 'Review'}
                  </>
                )}
              </Button>
            </div>
          </div>

          <CollapsibleContent className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Compliance Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Compliance Type</label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select compliance type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPLIANCE_DOC_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_doc_type && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {COMPLIANCE_DOC_TYPE_LABELS[document.ai_suggested_doc_type]} 
                    ({Math.round(docTypeConfidence * 100)}%)
                  </p>
                )}
              </div>

              {/* Property Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Property {!selectedPropertyId && <span className="text-amber-500">*</span>}
                </label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger className={!selectedPropertyId ? 'border-amber-500' : ''}>
                    <SelectValue placeholder="Select property..." />
                  </SelectTrigger>
                  <SelectContent>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address_line}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_property_id && suggestedProperty && (
                  <p className="text-xs text-muted-foreground">
                    AI matched: {suggestedProperty.address_line.split(',')[0]}
                    ({Math.round(propertyConfidence * 100)}%)
                  </p>
                )}
              </div>

              {/* Issue Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Issue Date</label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                />
                {document.extracted_issue_date && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {format(new Date(document.extracted_issue_date), 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              {/* Expiry Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Expiry Date</label>
                <Input
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
                {document.expiry_date && document.expiry_date !== expiryDate && (
                  <p className="text-xs text-muted-foreground">
                    AI detected: {format(new Date(document.expiry_date), 'dd MMM yyyy')}
                  </p>
                )}
              </div>

              {/* Extracted Info */}
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
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}