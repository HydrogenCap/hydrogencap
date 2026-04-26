import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useDensity, useSetDensity, type Density } from '@/hooks/useAppSettings';
import { Rows3, Rows4 } from 'lucide-react';

/**
 * Subtle density toggle for data-heavy pages.
 * Persists via app_settings (useAppSettings) with a localStorage cache.
 */
export function DensityToggle() {
  const density = useDensity();
  const setDensity = useSetDensity();

  return (
    <ToggleGroup
      type="single"
      size="sm"
      value={density}
      onValueChange={(v) => {
        if (v === 'cosy' || v === 'dense') setDensity(v as Density);
      }}
      aria-label="Row density"
      data-testid="density-toggle"
      className="h-8 rounded-md border border-input bg-background"
    >
      <ToggleGroupItem
        value="cosy"
        aria-label="Cosy density"
        className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground"
      >
        <Rows3 className="h-3.5 w-3.5" />
        Cosy
      </ToggleGroupItem>
      <ToggleGroupItem
        value="dense"
        aria-label="Dense density"
        className="h-7 px-2 text-xs gap-1 data-[state=on]:bg-muted data-[state=on]:text-foreground text-muted-foreground"
      >
        <Rows4 className="h-3.5 w-3.5" />
        Dense
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/**
 * Mounts inside App so document.body['data-density'] always tracks the
 * current preference. Renders nothing.
 */
export function DensityBridge() {
  const density = useDensity();
  if (typeof document !== 'undefined') {
    if (density === 'dense') {
      document.body.setAttribute('data-density', 'dense');
    } else {
      document.body.removeAttribute('data-density');
    }
  }
  return null;
}
