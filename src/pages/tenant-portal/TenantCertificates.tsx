import { useQuery } from '@tanstack/react-query';
import { format, isPast, isBefore, addDays } from 'date-fns';
import { ShieldCheck, Download, AlertTriangle, CheckCircle2, Clock, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TenantPortalLayoutV2 } from '@/components/tenant-portal/TenantPortalLayoutV2';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { createSignedStorageUrl } from '@/lib/storagePaths';
import { toast } from 'sonner';

// Only show certificates tenants are legally entitled to see
const TENANT_VISIBLE_CERT_TYPES = [
  'gas_safety',
  'eicr',
  'epc',
  'hmo_licence',
  'fire_risk_assessment',
];

const CERT_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  gas_safety: {
    label: 'Gas Safety Certificate (CP12)',
    description: 'Annual gas safety check — landlords must provide a copy within 28 days',
  },
  eicr: {
    label: 'Electrical Installation Condition Report',
    description: 'Electrical safety inspection — valid for 5 years',
  },
  epc: {
    label: 'Energy Performance Certificate',
    description: 'Energy efficiency rating of the property — valid for 10 years',
  },
  hmo_licence: {
    label: 'HMO Licence',
    description: 'House in Multiple Occupation licence for shared properties',
  },
  fire_risk_assessment: {
    label: 'Fire Risk Assessment',
    description: 'Assessment of fire safety measures in the property',
  },
};

function getCertStatus(expiryDate: string | null): { label: string; variant: 'default' | 'destructive' | 'secondary'; icon: typeof CheckCircle2 } {
  if (!expiryDate) return { label: 'No expiry set', variant: 'secondary', icon: Clock };
  const expiry = new Date(expiryDate);
  if (isPast(expiry)) return { label: 'Expired', variant: 'destructive', icon: AlertTriangle };
  if (isBefore(expiry, addDays(new Date(), 30))) return { label: 'Expiring soon', variant: 'secondary', icon: AlertTriangle };
  return { label: 'Valid', variant: 'default', icon: CheckCircle2 };
}

export default function TenantCertificates() {
  const { tenancyId } = useTenantPortalSession();

  // Get the property_id for this tenancy
  const { data: tenancy } = useQuery({
    queryKey: ['tenant-certs-tenancy', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return null;
      const { data, error } = await supabase
        .from('tenancies')
        .select('property_id')
        .eq('id', tenancyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });

  // Fetch compliance items for this property (only tenant-visible types)
  const { data: complianceItems, isLoading } = useQuery({
    queryKey: ['tenant-certs-compliance', tenancy?.property_id],
    queryFn: async () => {
      if (!tenancy?.property_id) return [];
      const { data, error } = await supabase
        .from('compliance_items')
        .select(`
          id,
          compliance_type,
          issue_date,
          expiry_date,
          is_required,
          notes
        `)
        .eq('property_id', tenancy.property_id)
        .in('compliance_type', TENANT_VISIBLE_CERT_TYPES)
        .order('compliance_type');
      if (error) throw error;
      return data || [];
    },
    enabled: !!tenancy?.property_id,
  });

  // Fetch associated documents for compliance items
  const complianceItemIds = complianceItems?.map(c => c.id) || [];
  const { data: complianceDocs } = useQuery({
    queryKey: ['tenant-certs-docs', complianceItemIds],
    queryFn: async () => {
      if (complianceItemIds.length === 0) return [];
      const { data, error } = await supabase
        .from('compliance_documents')
        .select('*')
        .in('compliance_item_id', complianceItemIds)
        .eq('is_current', true);
      if (error) throw error;
      return data || [];
    },
    enabled: complianceItemIds.length > 0,
  });

  const handleDownload = async (fileUrl: string, fileName: string) => {
    try {
      const signedUrl = await createSignedStorageUrl('compliance', fileUrl);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = fileName;
      link.target = '_blank';
      link.click();
    } catch {
      toast.error('Unable to download certificate. Please try again.');
    }
  };

  const getDocForItem = (complianceItemId: string) =>
    complianceDocs?.find(d => d.compliance_item_id === complianceItemId);

  return (
    <TenantPortalLayoutV2>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" />
            Certificates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Safety and compliance certificates for your property
          </p>
        </div>

        {/* Info banner */}
        <Card className="bg-muted/50 border-muted">
          <CardContent className="py-3">
            <p className="text-sm text-muted-foreground">
              Under UK law, your landlord must provide you with copies of certain safety certificates.
              If any certificates are missing or expired, please contact your landlord or managing agent.
            </p>
          </CardContent>
        </Card>

        {isLoading ? (
          <LoadingState text="Loading certificates..." />
        ) : complianceItems && complianceItems.length > 0 ? (
          <div className="space-y-3">
            {complianceItems.map((item) => {
              const typeInfo = CERT_TYPE_LABELS[item.compliance_type] || {
                label: item.compliance_type,
                description: '',
              };
              const status = getCertStatus(item.expiry_date);
              const StatusIcon = status.icon;
              const doc = getDocForItem(item.id);

              return (
                <Card key={item.id}>
                  <CardContent className="py-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                          <h3 className="font-medium text-sm">{typeInfo.label}</h3>
                        </div>
                        <p className="text-xs text-muted-foreground pl-6">{typeInfo.description}</p>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pl-6">
                          {item.issue_date && (
                            <span>Issued: {format(new Date(item.issue_date), 'dd MMM yyyy')}</span>
                          )}
                          {item.expiry_date && (
                            <span>Expires: {format(new Date(item.expiry_date), 'dd MMM yyyy')}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 pl-6 sm:pl-0">
                        <Badge variant={status.variant} className="flex items-center gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                        {doc ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownload(doc.file_url, doc.original_file_name)}
                          >
                            <Download className="mr-1.5 h-3.5 w-3.5" />
                            Download
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs text-muted-foreground">
                            No document
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="font-medium mb-1">No certificates available</h3>
              <p className="text-sm text-muted-foreground">
                Your landlord hasn't uploaded certificates for this property yet.
                If you believe this is an error, please contact your managing agent.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Certificates required notice */}
        <Card className="border-dashed">
          <CardContent className="py-3">
            <h4 className="text-sm font-medium mb-2">Your rights</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>• Gas Safety Certificate must be provided within 28 days of the annual check</li>
              <li>• EICR must be provided within 28 days of the inspection</li>
              <li>• EPC must be shown before you sign a tenancy agreement</li>
              <li>• HMO licence (if applicable) must be displayed in the property</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </TenantPortalLayoutV2>
  );
}
