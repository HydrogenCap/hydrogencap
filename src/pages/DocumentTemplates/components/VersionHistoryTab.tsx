import { ArrowLeft, History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TemplateVersionHistory } from '@/components/templates/TemplateVersionHistory';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';

interface Props {
  versionTemplateId: string | null;
  setVersionTemplateId: (id: string | null) => void;
}

export function VersionHistoryTab({ versionTemplateId, setVersionTemplateId }: Props) {
  if (versionTemplateId) {
    const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === versionTemplateId);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setVersionTemplateId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
        </Button>
        <TemplateVersionHistory
          templateId={versionTemplateId}
          templateName={tmpl?.name || versionTemplateId}
        />
      </div>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {DOCUMENT_TEMPLATES.map(t => (
        <Card
          key={t.id}
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setVersionTemplateId(t.id)}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" className="w-full">
              <History className="h-4 w-4 mr-1" /> View History
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
