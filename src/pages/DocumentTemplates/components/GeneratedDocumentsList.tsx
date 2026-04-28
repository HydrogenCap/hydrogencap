import { format } from 'date-fns';
import { FileDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';
import { STATUS_BADGE } from '../utils/types';

interface DocV2 {
  id: string;
  template_id: string;
  title?: string | null;
  status: string;
  created_at: string;
}

interface Props {
  generatedDocsV2: DocV2[] | undefined;
  updateDocStatus: { mutate: (vars: { id: string; status: string; signed_at?: string }) => void };
}

export function GeneratedDocumentsList({ generatedDocsV2, updateDocStatus }: Props) {
  const docs = generatedDocsV2 || [];
  return (
    <div className="space-y-4">
      {docs.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground py-8">
              <FileDown className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No generated documents yet.</p>
              <p className="mt-1">Use the Document Generator to create your first document.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map(d => {
            const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === d.template_id);
            const badge = STATUS_BADGE[d.status] || STATUS_BADGE.draft;
            return (
              <Card key={d.id}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{d.title || tmpl?.name || d.template_id}</span>
                        <Badge variant={badge.variant} className="text-xs">{badge.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(d.created_at), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {d.status === 'draft' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateDocStatus.mutate({ id: d.id, status: 'final' })}
                        >
                          Finalise
                        </Button>
                      )}
                      {d.status === 'final' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateDocStatus.mutate({ id: d.id, status: 'sent_for_signing' })}
                        >
                          Mark Sent
                        </Button>
                      )}
                      {d.status === 'sent_for_signing' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateDocStatus.mutate({ id: d.id, status: 'signed', signed_at: new Date().toISOString() })}
                        >
                          Mark Signed
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
