import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LayoutGrid, List, GitBranch } from 'lucide-react';
import { PRIORITY_NAMES } from '@/lib/complianceTaskTypes';

export type ViewMode = 'pipeline' | 'board' | 'list';

interface Props {
  view: ViewMode;
  setView: (v: ViewMode) => void;
  priorityFilter: string;
  setPriorityFilter: (p: string) => void;
  showCompleted: boolean;
  setShowCompleted: (b: boolean) => void;
}

export function FiltersBar({ view, setView, priorityFilter, setPriorityFilter, showCompleted, setShowCompleted }: Props) {
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <Select value={priorityFilter} onValueChange={setPriorityFilter}>
        <SelectTrigger className="w-36"><SelectValue placeholder="Priority" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {(['critical', 'high', 'medium', 'low'] as const).map(p => (
            <SelectItem key={p} value={p}>{PRIORITY_NAMES[p]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant={showCompleted ? 'secondary' : 'outline'} size="sm" onClick={() => setShowCompleted(!showCompleted)}>
        {showCompleted ? 'Hide' : 'Show'} Completed
      </Button>
      <div className="ml-auto flex gap-1">
        <Button variant={view === 'pipeline' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('pipeline')} title="Pipeline View">
          <GitBranch className="h-4 w-4" />
        </Button>
        <Button variant={view === 'board' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('board')} title="Board View">
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon" onClick={() => setView('list')} title="List View">
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
