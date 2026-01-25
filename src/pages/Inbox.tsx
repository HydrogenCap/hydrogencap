import { useState } from 'react';
import { Inbox as InboxIcon, RefreshCw, CheckCheck } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DocumentUploadZone } from '@/components/inbox/DocumentUploadZone';
import { DocumentReviewCard } from '@/components/inbox/DocumentReviewCard';
import { useInboxDocuments, useUpdateDocument } from '@/hooks/useDocuments';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function Inbox() {
  const { data: documents, isLoading, refetch } = useInboxDocuments();
  const updateDocument = useUpdateDocument();
  const { toast } = useToast();
  const [isAcceptingAll, setIsAcceptingAll] = useState(false);

  const pendingDocs = documents?.filter(d => d.review_status === 'pending') || [];
  const processingDocs = documents?.filter(d => 
    d.extraction_status === 'pending' || d.extraction_status === 'processing'
  ) || [];
  const readyDocs = pendingDocs.filter(d => d.extraction_status === 'completed');

  const handleAcceptAll = async () => {
    const docsToAccept = readyDocs.filter(d => 
      d.ai_suggested_doc_type && 
      (d.ai_doc_type_confidence || 0) >= 0.7
    );

    if (docsToAccept.length === 0) {
      toast({
        title: 'No high-confidence documents',
        description: 'No documents with high AI confidence to auto-accept',
      });
      return;
    }

    setIsAcceptingAll(true);
    let accepted = 0;

    try {
      for (const doc of docsToAccept) {
        await updateDocument.mutateAsync({
          id: doc.id,
          review_status: 'accepted',
          doc_type: doc.ai_suggested_doc_type,
          property_id: doc.ai_suggested_property_id,
        });
        accepted++;
      }

      toast({
        title: `Accepted ${accepted} documents`,
        description: 'High-confidence AI suggestions were applied',
      });
    } catch (err) {
      toast({
        title: 'Failed to accept some documents',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      });
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
              <InboxIcon className="h-6 w-6" />
              Document Inbox
              {pendingDocs.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {pendingDocs.length}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              Upload and review documents with AI-powered classification
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
            {readyDocs.length > 0 && (
              <Button 
                variant="outline"
                onClick={handleAcceptAll}
                disabled={isAcceptingAll}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Accept All High-Confidence
              </Button>
            )}
          </div>
        </div>

        {/* Upload Zone */}
        <DocumentUploadZone onUploadComplete={() => refetch()} />

        {/* Document List */}
        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList>
            <TabsTrigger value="pending" className="gap-2">
              Pending Review
              {pendingDocs.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {pendingDocs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processing" className="gap-2">
              Processing
              {processingDocs.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1.5">
                  {processingDocs.length}
                </Badge>
              )}
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
                <InboxIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">Inbox Zero!</p>
                <p className="text-sm">No documents pending review</p>
              </div>
            ) : (
              readyDocs.map(doc => (
                <DocumentReviewCard key={doc.id} document={doc} />
              ))
            )}
          </TabsContent>

          <TabsContent value="processing" className="space-y-3">
            {processingDocs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium">No documents processing</p>
                <p className="text-sm">Upload documents to start AI analysis</p>
              </div>
            ) : (
              processingDocs.map(doc => (
                <DocumentReviewCard key={doc.id} document={doc} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
