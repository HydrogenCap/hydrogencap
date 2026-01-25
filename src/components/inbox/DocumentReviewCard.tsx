import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, MapPin, Calendar, Check, X, ChevronDown, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUpdateDocument, useDeleteDocument } from '@/hooks/useDocuments';
import { useProperties } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { createFinalFilename } from '@/lib/documentNaming';
import type { Database } from '@/integrations/supabase/types';

type Document = Database['public']['Tables']['documents']['Row'];

const DOC_TYPE_LABELS: Record<string, string> = {
  epc_certificate: 'EPC Certificate',
  gas_safety_certificate: 'Gas Safety Certificate',
  electrical_certificate: 'Electrical Certificate',
  insurance_policy: 'Insurance Policy',
  tenancy_agreement: 'Tenancy Agreement',
  mortgage_offer: 'Mortgage Offer',
  valuation_report: 'Valuation Report',
  inventory: 'Inventory',
  rent_statement: 'Rent Statement',
  service_charge: 'Service Charge',
  ground_rent: 'Ground Rent',
  council_tax: 'Council Tax',
  utility_bill: 'Utility Bill',
  asbestos_management_survey: 'Asbestos Management Survey',
  asbestos_rd_survey: 'Asbestos R&D Survey',
  other: 'Other',
};

interface DocumentReviewCardProps {
  document: Document;
}

export function DocumentReviewCard({ document }: DocumentReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState(document.ai_suggested_doc_type || '');
  const [selectedPropertyId, setSelectedPropertyId] = useState(document.ai_suggested_property_id || '');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const updateDocument = useUpdateDocument();
  const deleteDocument = useDeleteDocument();
  const { data: properties } = useProperties();
  const { toast } = useToast();

  const isProcessed = document.extraction_status === 'completed';
  const isPending = document.extraction_status === 'pending' || document.extraction_status === 'processing';

  const docTypeConfidence = document.ai_doc_type_confidence || 0;
  const propertyConfidence = document.ai_property_confidence || 0;

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.8) return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">High</Badge>;
    if (confidence >= 0.5) return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Medium</Badge>;
    return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Low</Badge>;
  };

  const handleAccept = async () => {
    if (!selectedDocType) {
      toast({ title: 'Select a document type', variant: 'destructive' });
      return;
    }

    setIsProcessing(true);
    try {
      // Get property address for filename
      const selectedProperty = properties?.find(p => p.id === selectedPropertyId);
      
      // Generate standardized filename
      const finalFileName = createFinalFilename({
        docType: selectedDocType,
        propertyAddress: selectedProperty?.address_line,
        issueDate: document.extracted_issue_date,
        expiryDate: document.expiry_date,
        originalFilename: document.original_file_name,
      });

      await updateDocument.mutateAsync({
        id: document.id,
        review_status: 'accepted',
        doc_type: selectedDocType,
        property_id: selectedPropertyId || null,
        final_file_name: finalFileName,
        renamed_at: new Date().toISOString(),
      });
      
      toast({ 
        title: 'Document accepted',
        description: `Renamed to: ${finalFileName}`,
      });
    } catch (err) {
      toast({ 
        title: 'Failed to accept', 
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await deleteDocument.mutateAsync(document.id);
      toast({ title: 'Document deleted' });
    } catch (err) {
      toast({ 
        title: 'Failed to delete', 
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestedProperty = properties?.find(p => p.id === document.ai_suggested_property_id);

  return (
    <Card className="bg-card border-border">
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
                <p className="font-medium text-foreground truncate">
                  {document.original_file_name}
                </p>
                {isPending && (
                  <Badge variant="outline" className="shrink-0">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Processing
                  </Badge>
                )}
              </div>

              {isProcessed && (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary">
                    {DOC_TYPE_LABELS[document.ai_suggested_doc_type || ''] || 'Unknown'}
                  </Badge>
                  {getConfidenceBadge(docTypeConfidence)}
                  
                  {suggestedProperty && (
                    <>
                      <span className="text-muted-foreground">→</span>
                      <span className="text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {suggestedProperty.address_line.split(',')[0]}
                      </span>
                      {getConfidenceBadge(propertyConfidence)}
                    </>
                  )}

                  {document.expiry_date && (
                    <span className="text-muted-foreground flex items-center gap-1 ml-2">
                      <Calendar className="h-3 w-3" />
                      Expires {format(new Date(document.expiry_date), 'dd MMM yyyy')}
                    </span>
                  )}
                </div>
              )}

              {!isProcessed && document.extracted_address_text && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {document.extracted_address_text}
                </p>
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
                size="icon"
                onClick={handleAccept}
                disabled={isProcessing || !isProcessed}
              >
                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <CollapsibleContent className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Document Type Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Document Type</label>
                <Select value={selectedDocType} onValueChange={setSelectedDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_doc_type && (
                  <p className="text-xs text-muted-foreground">
                    AI suggested: {DOC_TYPE_LABELS[document.ai_suggested_doc_type]} 
                    ({Math.round(docTypeConfidence * 100)}% confidence)
                  </p>
                )}
              </div>

              {/* Property Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Property</label>
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No property</SelectItem>
                    {properties?.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.address_line}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {document.ai_suggested_property_id && suggestedProperty && (
                  <p className="text-xs text-muted-foreground">
                    AI suggested: {suggestedProperty.address_line.split(',')[0]}
                    ({Math.round(propertyConfidence * 100)}% confidence)
                  </p>
                )}
              </div>

              {/* Extracted Info */}
              {(document.extracted_address_text || document.extracted_reference_number || document.extracted_epc_rating) && (
                <div className="md:col-span-2 p-3 bg-muted/50 rounded-lg space-y-1">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    Extracted Information
                  </p>
                  <div className="text-sm text-muted-foreground space-y-1">
                    {document.extracted_address_text && (
                      <p>Address: {document.extracted_address_text}</p>
                    )}
                    {document.extracted_reference_number && (
                      <p>Reference: {document.extracted_reference_number}</p>
                    )}
                    {document.extracted_epc_rating && (
                      <p>EPC Rating: {document.extracted_epc_rating}</p>
                    )}
                    {document.expiry_date && (
                      <p>Expiry: {format(new Date(document.expiry_date), 'dd MMMM yyyy')}</p>
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
