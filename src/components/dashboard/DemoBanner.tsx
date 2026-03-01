import { AlertCircle, X, Sparkles, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDemoData } from '@/hooks/useDemoData';
import { useNavigate } from 'react-router-dom';

export function DemoBanner() {
  const { hasDemoData, isLoading, clear } = useDemoData();
  const navigate = useNavigate();

  if (isLoading || !hasDemoData) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <AlertCircle className="h-4 w-4 text-primary shrink-0" />
      <span className="text-foreground flex-1">
        You're viewing demo data.
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="text-destructive hover:text-destructive h-auto py-1 px-2"
        onClick={() => clear.mutate()}
        disabled={clear.isPending}
      >
        {clear.isPending ? 'Removing…' : 'Remove demo data'}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto py-1 px-2"
        onClick={() => navigate('/properties-v2')}
      >
        <Plus className="h-3 w-3 mr-1" />
        Add a real property
      </Button>
    </div>
  );
}
