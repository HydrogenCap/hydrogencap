import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Shield, RefreshCw, CheckCheck, Upload, AlertTriangle, CheckCircle2, Brain, Settings2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUploadZone } from '@/components/inbox/DocumentUploadZone';
import { ComplianceReviewCard } from '@/components/inbox/ComplianceReviewCard';
import { AIProcessingDashboard } from '@/components/inbox/AIProcessingDashboard';
import { AISettingsPanel } from '@/components/inbox/AISettingsPanel';
import { useInboxDocuments } from '@/hooks/useDocuments';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAcceptAllHighConfidence, COMPLIANCE_DOC_TYPE_LABELS } from '@/hooks/useComplianceIntake';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export default function Inbox() {
  const { data: documents, isLoading, refetch } = useInboxDocuments();
  const { data: complianceMatrixRows } = useQuery({
    queryKey: ['compliance_matrix_v2_inbox'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('compliance_matrix_v2' as any)
        .select('calculated_status');
      if (error) throw error;
      return (data || []) as unknown as Array<{ calculated_status: string }>;
    },
  });
  const acceptAllHighConfidence = useAcceptAllHighConfidence();
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);

  const pendingDocs = documents?.filter(d => d.review_status === 'pending') || [];
  const processingDocs = documents?.filter(d => 
    d.extraction_status === 'pending' || d.extraction_status === 'processing'
  ) || [];
  const failedDocs = documents?.filter(d => 
    d.extraction_status === 'failed' && d.review_status === 'pending'
  ) || [];
  const readyDocs = pendingDocs.filter(d => d.extraction_status === 'completed');

  // High confidence = both doc type and property match >= 70%
  const highConfidenceDocs = readyDocs.filter(d => 
    d.ai_suggested_doc_type && 
    (d.ai_doc_type_confidence || 0) >= 0.7 &&
    d.ai_suggested_property_id &&
    (d.ai_property_confidence || 0) >= 0.7
  );

  // Calculate compliance stats from V2 matrix
  const complianceStats = useMemo(() => {
    if (!complianceMatrixRows) return { valid: 0, expiring: 0, expired: 0 };
    return {
      valid: complianceMatrixRows.filter(r => r.calculated_status === 'valid').length,
      expiring: complianceMatrixRows.filter(r => r.calculated_status === 'expiring_soon').length,
      expired: complianceMatrixRows.filter(r =>
        r.calculated_status === 'expired' || r.calculated_status === 'missing'
      ).length,
    };
  }, [complianceMatrixRows]);

  const handleAcceptAll = async () => {
    if (highConfidenceDocs.length === 0) return;
    setIsAcceptingAll(true);
    try {
      await acceptAllHighConfidence.mutateAsync(highConfidenceDocs as any);
    } finally {
      setIsAcceptingAll(false);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Compliance Inbox
              {pendingDocs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingDocs.length} pending
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              AI-powered compliance document intake and management
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {highConfidenceDocs.length > 0 && (
              <Button 
                onClick={handleAcceptAll}
                disabled={isAcceptingAll}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Confirm All ({highConfidenceDocs.length})
              </Button>
            )}
          </div>
        </div>

        {/* Compliance Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Valid</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                <span className="text-2xl font-bold">{complianceStats.valid}</span>
              </div>
            </CardContent>
          </Card>
          <Link to="/compliance-v2">
            <Card className={cn('cursor-pointer hover:bg-muted/50 transition-colors', complianceStats.expiring > 0 && 'border-amber-500/50')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expiring Soon</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <span className="text-2xl font-bold">{complianceStats.expiring}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/compliance-v2">
            <Card className={cn('cursor-pointer hover:bg-muted/50 transition-colors', complianceStats.expired > 0 && 'border-destructive/50')}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Expired</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold">{complianceStats.expired}</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Compliance Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DocumentUploadZone onUploadComplete={() => refetch()} />
            <p className="text-xs text-muted-foreground mt-2">
              Upload certificates, licences, and compliance documents. AI will automatically classify, 
              extract dates, and match to your properties.
            </p>
          </CardContent>
        </Card>

        {/* Document List */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Ready for Review
              {readyDocs.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {readyDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processing" className="gap-2">
              Analysing
              {(processingDocs.length + failedDocs.length) > 0 && (
                <Badge variant={failedDocs.length > 0 ? "destructive" : "secondary"} className="h-5 min-w-5 px-1.5">
                  {processingDocs.length + failedDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="dashboard" className="gap-2">
              <Brain className="h-3.5 w-3.5" />
              AI Dashboard
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings2 className="h-3.5 w-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {isLoading ? (
              <>
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </>
            ) : readyDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm">No compliance documents pending review</p>
              </div>
            ) : (
              <>
                {highConfidenceDocs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Ready to confirm ({highConfidenceDocs.length})
                    </p>
                    {highConfidenceDocs.map(doc => (
                      <ComplianceReviewCard key={doc.id} document={doc} />
                    ))}
                  </div>
                )}
                
                {readyDocs.filter(d => !highConfidenceDocs.includes(d)).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      Needs review ({readyDocs.filter(d => !highConfidenceDocs.includes(d)).length})
                    </p>
                    {readyDocs.filter(d => !highConfidenceDocs.includes(d)).map(doc => (
                      <ComplianceReviewCard key={doc.id} document={doc} />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-3">
            {processingDocs.length === 0 && failedDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No documents analysing</p>
                <p className="text-sm">Upload documents to start AI analysis</p>
              </div>
            ) : (
              <>
                {failedDocs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Failed ({failedDocs.length}) — click Retry to reprocess
                    </p>
                    {failedDocs.map(doc => (
                      <ComplianceReviewCard key={doc.id} document={doc} />
                    ))}
                  </div>
                )}
                {processingDocs.map(doc => (
                  <ComplianceReviewCard key={doc.id} document={doc} />
                ))}
              </>
            )}
          </TabsContent>
          <TabsContent value="dashboard">
            <AIProcessingDashboard />
          </TabsContent>

          <TabsContent value="settings">
            <AISettingsPanel />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}