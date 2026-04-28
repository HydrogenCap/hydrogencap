import { ArrowLeft, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { DOCUMENT_TEMPLATES } from '@/lib/documentTemplates';

interface Props {
  editorTemplateId: string | null;
  setEditorTemplateId: (id: string | null) => void;
}

export function TemplateEditorTab({ editorTemplateId, setEditorTemplateId }: Props) {
  if (editorTemplateId) {
    const tmpl = DOCUMENT_TEMPLATES.find(t => t.id === editorTemplateId);
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setEditorTemplateId(null)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to templates
        </Button>
        <TemplateEditor
          templateId={editorTemplateId}
          templateName={tmpl?.name || editorTemplateId}
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
          onClick={() => setEditorTemplateId(t.id)}
        >
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-sm font-semibold">{t.name}</CardTitle>
              <Badge variant="outline" className="text-xs capitalize">{t.category}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">{t.description}</p>
            <Button variant="outline" size="sm" className="w-full">
              <Pencil className="h-4 w-4 mr-1" /> Edit Template
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
