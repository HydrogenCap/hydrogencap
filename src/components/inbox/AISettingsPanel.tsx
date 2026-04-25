import { useState, useEffect } from 'react';
import { Bot, Sliders } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';

export function AISettingsPanel() {
  const { data: settings, isLoading } = useAppSettings();
  const updateSetting = useUpdateAppSetting();

  const autoProcessEnabled = settings?.['ai_auto_process'] === 'true';
  const autoFileEnabled = settings?.['ai_auto_file'] === 'true';
  const threshold = parseInt(settings?.['ai_auto_file_threshold'] || '85', 10);

  const [localThreshold, setLocalThreshold] = useState(threshold);

  useEffect(() => {
    setLocalThreshold(threshold);
  }, [threshold]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Document Processing
          </CardTitle>
          <CardDescription className="text-xs">
            Control how the AI handles uploaded compliance documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Auto-process toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto-Classify Documents</Label>
              <p className="text-xs text-muted-foreground">
                Automatically classify and extract data from uploaded documents
              </p>
            </div>
            <Switch
              checked={autoProcessEnabled}
              onCheckedChange={(checked) =>
                updateSetting.mutate({ key: 'ai_auto_process', value: String(checked) })
              }
            />
          </div>

          {/* Auto-file toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Auto-File High Confidence</Label>
              <p className="text-xs text-muted-foreground">
                Automatically file documents that exceed the confidence threshold
              </p>
            </div>
            <Switch
              checked={autoFileEnabled}
              onCheckedChange={(checked) =>
                updateSetting.mutate({ key: 'ai_auto_file', value: String(checked) })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Confidence Threshold */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Sliders className="h-4 w-4" />
            Auto-File Confidence Threshold
          </CardTitle>
          <CardDescription className="text-xs">
            Documents must exceed this confidence level to be auto-filed without review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Threshold</span>
              <span className="text-lg font-bold">{localThreshold}%</span>
            </div>
            <Slider
              value={[localThreshold]}
              onValueChange={([v]) => setLocalThreshold(v)}
              min={50}
              max={99}
              step={1}
              disabled={!autoFileEnabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50% (more auto-filing)</span>
              <span>99% (stricter)</span>
            </div>
          </div>

          {localThreshold !== threshold && (
            <Button
              size="sm"
              onClick={() =>
                updateSetting.mutate({ key: 'ai_auto_file_threshold', value: String(localThreshold) })
              }
              disabled={updateSetting.isPending}
            >
              Save Threshold
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
