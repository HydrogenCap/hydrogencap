import React from 'react';
import { Building, Users, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ViewMode } from './types';

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function ViewModeToggle({ mode, onModeChange }: ViewModeToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg bg-muted/50 p-1 border border-border/50">
      <button
        onClick={() => onModeChange('gross')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
          mode === 'gross'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Building className="h-3.5 w-3.5" />
        <span>Gross Property Figures</span>
      </button>
      <button
        onClick={() => onModeChange('attributed')}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150',
          mode === 'attributed'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
        )}
      >
        <Users className="h-3.5 w-3.5" />
        <span>Ownership-Attributed</span>
        {mode === 'attributed' && (
          <Check className="h-3.5 w-3.5 text-success" />
        )}
      </button>
    </div>
  );
}
