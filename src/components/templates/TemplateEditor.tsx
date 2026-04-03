import { useState, useRef, useCallback, useMemo } from 'react';
import { Save, Eye, EyeOff, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  MERGE_FIELDS,
  MERGE_FIELD_CATEGORIES,
  mergeTemplate,
  buildSampleMergeData,
  extractMergeFields,
} from '@/lib/template-merge';
import { useLatestTemplateVersion, useSaveTemplateVersion } from '@/hooks/useTemplateUpgrade';

interface TemplateEditorProps {
  templateId: string;
  templateName: string;
  onSaved?: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  landlord: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  property: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  tenant: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  tenancy: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  dates: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export function TemplateEditor({ templateId, templateName, onSaved }: TemplateEditorProps) {
  const { toast } = useToast();
  const editorRef = useRef<HTMLDivElement>(null);
  const { data: latestVersion, isLoading } = useLatestTemplateVersion(templateId);
  const saveMutation = useSaveTemplateVersion();

  const [content, setContent] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState('');
  const [preview, setPreview] = useState(false);

  // Initialize content from latest version once loaded
  const editorContent = content ?? latestVersion?.content ?? '';

  const sampleData = useMemo(() => buildSampleMergeData(), []);
  const previewContent = useMemo(() => mergeTemplate(editorContent, sampleData), [editorContent, sampleData]);
  const usedFields = useMemo(() => extractMergeFields(editorContent), [editorContent]);

  const insertMergeField = useCallback((fieldKey: string) => {
    const tag = `{{${fieldKey}}}`;
    const editor = editorRef.current;
    if (!editor) {
      setContent(prev => (prev ?? editorContent) + tag);
      return;
    }

    editor.focus();
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      // Only insert at cursor if it's inside the editor
      if (editor.contains(range.startContainer)) {
        range.deleteContents();
        range.insertNode(document.createTextNode(tag));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        editor.appendChild(document.createTextNode(tag));
      }
    } else {
      editor.appendChild(document.createTextNode(tag));
    }
    setContent(editor.innerText);
  }, [editorContent]);

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      setContent(editorRef.current.innerText);
    }
  }, []);

  const handleSave = async () => {
    const text = content ?? editorContent;
    if (!text.trim()) {
      toast({ title: 'Empty template', description: 'Add some content before saving.', variant: 'destructive' });
      return;
    }

    try {
      await saveMutation.mutateAsync({
        template_id: templateId,
        content: text,
        change_summary: changeSummary || undefined,
      });
      setChangeSummary('');
      toast({ title: 'Version saved', description: `Template "${templateName}" saved successfully.` });
      onSaved?.();
    } catch (err) {
      toast({
        title: 'Save failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading template...</div>;
  }

  // Render merge field chips for used fields
  const renderUsedFieldChips = () => {
    if (usedFields.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1">
        {usedFields.map(key => {
          const def = MERGE_FIELDS.find(f => f.key === key);
          return (
            <Badge key={key} variant="secondary" className={`text-xs ${CATEGORY_COLORS[def?.category || 'dates']}`}>
              {def?.label || key}
            </Badge>
          );
        })}
      </div>
    );
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {/* Main editor area */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{templateName}</h3>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreview(!preview)}>
              {preview ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
              {preview ? 'Edit' : 'Preview'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              Save Version
            </Button>
          </div>
        </div>

        {renderUsedFieldChips()}

        {preview ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Preview (with sample data)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed border rounded-md p-4 bg-muted/30 min-h-[300px]">
                {previewContent || <span className="text-muted-foreground italic">Empty template</span>}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            className="min-h-[300px] border rounded-md p-4 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-ring bg-background whitespace-pre-wrap"
            onInput={handleEditorInput}
            dangerouslySetInnerHTML={{ __html: editorContent.replace(/</g, '&lt;').replace(/>/g, '&gt;') }}
          />
        )}

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Change summary (optional)</Label>
            <Input
              placeholder="Describe what changed..."
              value={changeSummary}
              onChange={e => setChangeSummary(e.target.value)}
            />
          </div>
        </div>

        {latestVersion && (
          <p className="text-xs text-muted-foreground">
            Current: v{latestVersion.version_number}
            {latestVersion.change_summary && ` — ${latestVersion.change_summary}`}
          </p>
        )}
      </div>

      {/* Merge field insertion panel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1">
            <Plus className="h-4 w-4" /> Insert Merge Field
          </CardTitle>
          <p className="text-xs text-muted-foreground">Click a field to insert {"{{field}}"} at cursor</p>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Tabs defaultValue="landlord">
              <TabsList className="w-full flex-wrap h-auto p-1 mx-2">
                {MERGE_FIELD_CATEGORIES.map(cat => (
                  <TabsTrigger key={cat.value} value={cat.value} className="text-xs">
                    {cat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {MERGE_FIELD_CATEGORIES.map(cat => (
                <TabsContent key={cat.value} value={cat.value} className="px-3 pb-3">
                  <div className="space-y-1">
                    {MERGE_FIELDS.filter(f => f.category === cat.value).map(field => (
                      <button
                        key={field.key}
                        type="button"
                        className="w-full text-left px-2 py-1.5 rounded-md text-sm hover:bg-accent transition-colors group"
                        onClick={() => insertMergeField(field.key)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{field.label}</span>
                          {usedFields.includes(field.key) && (
                            <Badge variant="outline" className="text-[10px] h-4">in use</Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground group-hover:text-foreground">
                          {field.sampleValue}
                        </div>
                      </button>
                    ))}
                  </div>
                  <Separator className="mt-2" />
                </TabsContent>
              ))}
            </Tabs>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
