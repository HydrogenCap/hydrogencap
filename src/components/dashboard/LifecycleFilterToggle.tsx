import { Building2, Construction, Layers } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useLifecycleFilter, LifecycleFilter } from '@/contexts/LifecycleFilterContext';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function LifecycleFilterToggle() {
  const { lifecycleFilter, setLifecycleFilter } = useLifecycleFilter();

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground hidden sm:inline">View:</span>
        <ToggleGroup 
          type="single" 
          value={lifecycleFilter} 
          onValueChange={(value) => value && setLifecycleFilter(value as LifecycleFilter)}
          className="bg-muted/50 rounded-lg p-1"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem 
                value="core_rental" 
                aria-label="Core Rental" 
                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3"
              >
                <Building2 className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Core Rental</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>Income-producing properties with full compliance tracking</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem 
                value="development" 
                aria-label="Development"
                className="data-[state=on]:bg-warning data-[state=on]:text-warning-foreground px-3"
              >
                <Construction className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">Development</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>Properties in progress - excluded from income KPIs</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <ToggleGroupItem 
                value="all" 
                aria-label="All Properties"
                className="data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground px-3"
              >
                <Layers className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">All</span>
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent>
              <p>View all properties (combined view)</p>
            </TooltipContent>
          </Tooltip>
        </ToggleGroup>
      </div>
    </TooltipProvider>
  );
}
