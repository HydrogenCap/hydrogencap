import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Check } from 'lucide-react';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';
import {
  ALL_SECTION_KEYS,
  SECTION_LABELS,
  SECTION_DESCRIPTIONS,
  type SectionKey,
} from '@/lib/sectionVisibility';

export function SectionVisibilitySettings() {
  const { visibilitySettings, updateVisibility } = useSectionVisibility();
  const [savedKey, setSavedKey] = useState<SectionKey | null>(null);

  const handleToggle = async (key: SectionKey, value: boolean) => {
    await updateVisibility(key, value);
    setSavedKey(key);
    setTimeout(() => setSavedKey(null), 1500);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Sections</CardTitle>
        <CardDescription>
          Choose which sections are active in your account. Hidden sections will not appear in the navigation or dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {ALL_SECTION_KEYS.map((key) => (
          <div
            key={key}
            className="flex items-center justify-between py-3 px-2 rounded-md hover:bg-muted/50 transition-colors"
          >
            <div className="space-y-0.5">
              <p className="text-sm font-medium">{SECTION_LABELS[key]}</p>
              <p className="text-xs text-muted-foreground">{SECTION_DESCRIPTIONS[key]}</p>
            </div>
            <div className="flex items-center gap-2">
              {savedKey === key && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 animate-fade-in">
                  <Check className="h-3 w-3" /> Saved
                </span>
              )}
              <Switch
                checked={visibilitySettings[key]}
                onCheckedChange={(checked) => handleToggle(key, checked)}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
