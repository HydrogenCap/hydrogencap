import { LayoutGrid, Kanban } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export type JobsViewMode = 'grid' | 'list' | 'pipeline';

interface ViewModeToggleProps {
  value: JobsViewMode;
  onChange: (value: JobsViewMode) => void;
}

export function ViewModeToggle({ value, onChange }: ViewModeToggleProps) {
  return (
    <ToggleGroup 
      type="single" 
      value={value} 
      onValueChange={(v) => v && onChange(v as JobsViewMode)}
      className="border rounded-lg p-0.5"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="grid" aria-label="Grid view" className="h-8 w-8 p-0">
            <LayoutGrid className="h-4 w-4" />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Grid view</TooltipContent>
      </Tooltip>
      
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="pipeline" aria-label="Pipeline view" className="h-8 w-8 p-0">
            <Kanban className="h-4 w-4" />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>Pipeline view</TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
