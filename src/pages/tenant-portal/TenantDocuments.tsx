import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { FileText, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TenantPortalLayout } from '@/components/tenant-portal/TenantPortalLayout';
import { useTenantPortalSession } from '@/hooks/useTenantPortalSession';
import { supabase } from '@/integrations/supabase/client';
import { LoadingState } from '@/components/common/LoadingState';
import { createSignedStorageUrl } from '@/lib/storagePaths';

export default function TenantDocuments() {
  const { tenancyId, canViewDocuments } = useTenantPortalSession();

  const { data: documents, isLoading } = useQuery({
    queryKey: ['tenant-portal-documents', tenancyId],
    queryFn: async () => {
      if (!tenancyId) return [];
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .eq('visible_to_tenants', true)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: canViewDocuments && !!tenancyId,
  });

  const handleView = async (fileUrl: string) => {
    const signedUrl = await createSignedStorageUrl('documents', fileUrl);
    window.open(signedUrl, '_blank');
  };

  return (
    <TenantPortalLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Documents</h1>
        </div>

        {isLoading ? (
          <LoadingState text="Loading documents..." />
        ) : documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id}>
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div>
                        <h3 className="font-medium">{doc.display_name || doc.original_file_name}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {doc.doc_type && <Badge variant="outline" className="text-xs">{doc.doc_type}</Badge>}
                          <span>Added {format(new Date(doc.created_at), 'dd MMM yyyy')}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleView(doc.file_url)}>
                      <Eye className="mr-2 h-4 w-4" />
                      View
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
              <h3 className="font-medium mb-1">No documents available</h3>
              <p className="text-sm text-muted-foreground">
                Your landlord hasn't shared any documents with you yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </TenantPortalLayout>
  );
}
