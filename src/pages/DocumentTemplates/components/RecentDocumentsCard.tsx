import { format } from 'date-fns';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';

interface Props {
  recentDocs: Array<{ id: string; template_id: string; created_at: string }> | undefined;
}

export function RecentDocumentsCard({ recentDocs }: Props) {
  if (!recentDocs?.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" /> Recent Documents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentDocs.slice(0, 10).map(d => {
            const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === d.template_id);
            return (
              <div key={d.id} className="flex items-center justify-between text-sm border-b border-border pb-2">
                <span>{tmpl?.name || d.template_id}</span>
                <span className="text-muted-foreground">{format(new Date(d.created_at), 'dd MMM yyyy')}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
