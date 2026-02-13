import { RefObject } from 'react';
import {
  Eye,
  ShieldCheck,
  AlertTriangle,
  Download,
  X,
  Building2,
  Home,
  Users,
  Banknote,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';

const fmt = (n: number) => n >= 1_000_000 ? `£${(n / 1_000_000).toFixed(2)}M` : `£${(n / 1_000).toFixed(0)}k`;

interface FlowchartToolbarProps {
  overlayMode: 'type' | 'compliance';
  onOverlayChange: (mode: 'type' | 'compliance') => void;
  anySelected: boolean;
  onClearSelection: () => void;
  warningCount: number;
  onToggleWarnings: () => void;
  svgRef: RefObject<SVGSVGElement | null>;
  totalValue: number;
  companyCount: number;
  propertyCount: number;
  personCount: number;
}

export function FlowchartToolbar({
  overlayMode,
  onOverlayChange,
  anySelected,
  onClearSelection,
  warningCount,
  onToggleWarnings,
  svgRef,
  totalValue,
  companyCount,
  propertyCount,
  personCount,
}: FlowchartToolbarProps) {

  const handleExportPng = async () => {
    if (!svgRef.current) return;

    const svgElement = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = svgElement.clientWidth * scale;
      canvas.height = svgElement.clientHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `ownership-structure-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  return (
    <div className="space-y-3 mb-4">
      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-1 bg-border rounded-xl overflow-hidden">
        {[
          { icon: Users, label: 'Shareholders', value: personCount },
          { icon: Building2, label: 'Companies', value: companyCount },
          { icon: Home, label: 'Properties', value: propertyCount },
          { icon: Banknote, label: 'Portfolio Value', value: fmt(totalValue) },
        ].map(stat => (
          <div key={stat.label} className="bg-card p-3 text-center">
            <div className="text-lg font-bold">{stat.value}</div>
            <div className="text-[10px] text-muted-foreground font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ToggleGroup
          type="single"
          value={overlayMode}
          onValueChange={(v) => v && onOverlayChange(v as 'type' | 'compliance')}
          className="bg-muted rounded-lg p-1"
        >
          <ToggleGroupItem value="type" size="sm" className="gap-1.5 text-xs">
            <Eye className="h-3.5 w-3.5" />
            Property Type
          </ToggleGroupItem>
          <ToggleGroupItem value="compliance" size="sm" className="gap-1.5 text-xs">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance
          </ToggleGroupItem>
        </ToggleGroup>

        {warningCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onToggleWarnings}>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            <span>{warningCount} Warning{warningCount !== 1 ? 's' : ''}</span>
          </Button>
        )}

        <div className="flex-1" />

        {anySelected && (
          <Button variant="outline" size="sm" onClick={onClearSelection} className="gap-1.5">
            <X className="h-3.5 w-3.5" />
            Show All
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleExportPng} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export PNG
        </Button>
      </div>
    </div>
  );
}
