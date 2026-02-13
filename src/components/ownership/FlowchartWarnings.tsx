import { AlertTriangle, XCircle, AlertCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { StructuralWarning } from '@/hooks/useOwnershipFlowchart';

interface FlowchartWarningsProps {
  warnings: StructuralWarning[];
  onClickEntity: (id: string) => void;
  onClose: () => void;
}

export function FlowchartWarnings({ warnings, onClickEntity, onClose }: FlowchartWarningsProps) {
  const errors = warnings.filter(w => w.severity === 'error');
  const warns = warnings.filter(w => w.severity === 'warning');

  return (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
            {warnings.length} structural issue{warnings.length !== 1 ? 's' : ''} found
          </span>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {errors.map((w, i) => (
          <div
            key={`e-${i}`}
            className="flex items-start gap-2 text-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-2 py-1 transition-colors"
            onClick={() => onClickEntity(w.entityId)}
          >
            <XCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
            <span className="text-foreground">{w.message}</span>
          </div>
        ))}
        {warns.map((w, i) => (
          <div
            key={`w-${i}`}
            className="flex items-start gap-2 text-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded px-2 py-1 transition-colors"
            onClick={() => onClickEntity(w.entityId)}
          >
            <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <span className="text-foreground">{w.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
