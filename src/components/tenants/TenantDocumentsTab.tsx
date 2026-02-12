import { FileText, Upload, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TenantDocumentsTabProps {
  documents: any[] | undefined;
  onUploadClick: () => void;
}

export function TenantDocumentsTab({ documents, onUploadClick }: TenantDocumentsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onUploadClick}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {!documents || documents.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            No documents yet
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((doc: any) => (
            <Card key={doc.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium truncate">{doc.display_name || doc.original_file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {doc.doc_type && <Badge variant="outline" className="text-[10px]">{doc.doc_type}</Badge>}
                      {doc.created_at && <span>{format(new Date(doc.created_at), 'dd MMM yyyy')}</span>}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3 w-3 mr-1" />
                    View
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
