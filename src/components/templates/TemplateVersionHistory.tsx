import { useState } from 'react';
import { format } from 'date-fns';
import { History, RotateCcw, Eye, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useTemplateVersions, useRestoreTemplateVersion, type TemplateVersion } from '@/hooks/useTemplateUpgrade';

interface TemplateVersionHistoryProps {
  templateId: string;
  templateName: string;
  onRestored?: () => void;
}

export function TemplateVersionHistory({ templateId, templateName, onRestored }: TemplateVersionHistoryProps) {
  const { toast } = useToast();
  const { data: versions, isLoading } = useTemplateVersions(templateId);
  const restoreMutation = useRestoreTemplateVersion();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewingContent, setViewingContent] = useState<string | null>(null);

  const handleRestore = async (version: TemplateVersion) => {
    try {
      await restoreMutation.mutateAsync({
        template_id: templateId,
        content: version.content,
        restored_from_version: version.version_number,
      });
      toast({
        title: 'Version restored',
        description: `Restored v${version.version_number} as a new version.`,
      });
      onRestored?.();
    } catch (err) {
      toast({
        title: 'Restore failed',
        description: err instanceof Error ? err.message : 'Something went wrong',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading version history...</div>;
  }

  if (!versions?.length) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-sm text-muted-foreground py-8">
            <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p>No versions saved yet.</p>
            <p className="mt-1">Save a template in the editor to start tracking versions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{templateName} — Version History</h3>
        <Badge variant="secondary" className="text-xs">{versions.length} version(s)</Badge>
      </div>

      {/* Content viewer */}
      {viewingContent !== null && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm text-muted-foreground">Version Content</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setViewingContent(null)}>Close</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed border rounded-md p-4 bg-muted/30 max-h-[400px] overflow-auto">
              {viewingContent}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Version list */}
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {versions.map((v, i) => {
            const isLatest = i === 0;
            const isExpanded = expandedId === v.id;

            return (
              <Card key={v.id} className={isLatest ? 'border-primary/30' : ''}>
                <CardContent className="py-3 px-4">
                  <div
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : v.id)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      <span className="font-medium text-sm">v{v.version_number}</span>
                      {isLatest && <Badge className="text-xs">Current</Badge>}
                      {v.change_summary && (
                        <span className="text-sm text-muted-foreground truncate max-w-[300px]">
                          — {v.change_summary}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(v.created_at), 'dd MMM yyyy HH:mm')}
                    </span>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 space-y-3">
                      <Separator />
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setViewingContent(v.content)}
                        >
                          <Eye className="h-4 w-4 mr-1" /> View Content
                        </Button>
                        {!isLatest && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleRestore(v)}
                            disabled={restoreMutation.isPending}
                          >
                            <RotateCcw className="h-4 w-4 mr-1" /> Restore
                          </Button>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {v.content.length} characters
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
