import { FileText, Upload } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function Inbox() {
  // Placeholder - will fetch from database
  const documents: unknown[] = [];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Document Inbox</h1>
            <p className="text-muted-foreground">Review and file uploaded documents</p>
          </div>
          <Button>
            <Upload className="h-4 w-4 mr-2" />
            Upload Document
          </Button>
        </div>

        {/* Documents List or Empty State */}
        {documents.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="rounded-full bg-muted p-4 mb-4">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">Inbox zero!</h3>
              <p className="text-muted-foreground mb-4">
                No documents need your attention
              </p>
              <Button variant="outline">
                <Upload className="h-4 w-4 mr-2" />
                Upload a document
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="text-muted-foreground">
            Documents will appear here
          </div>
        )}
      </div>
    </AppLayout>
  );
}
