import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ChevronDown, X, Percent, Calendar, Building2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface BulkActionsProps {
  selectedIds: Set<string>;
  onClearSelection: () => void;
}

export function BulkActions({ selectedIds, onClearSelection }: BulkActionsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [newRate, setNewRate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const count = selectedIds.size;
  if (count === 0) return null;

  const handleUpdateRates = async () => {
    if (!newRate || isNaN(parseFloat(newRate))) {
      toast({ title: 'Invalid rate', description: 'Please enter a valid interest rate.', variant: 'destructive' });
      return;
    }

    setIsUpdating(true);
    try {
      // Get property IDs and update their loans
      const propertyIds = Array.from(selectedIds);
      
      const { error } = await supabase
        .from('loans')
        .update({ interest_rate_percent: parseFloat(newRate) })
        .in('property_id', propertyIds);

      if (error) throw error;

      toast({ 
        title: 'Rates updated', 
        description: `Updated interest rate to ${newRate}% for ${count} properties.` 
      });
      
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      setShowRateDialog(false);
      setNewRate('');
      onClearSelection();
    } catch (error) {
      toast({ 
        title: 'Error', 
        description: 'Failed to update rates. Please try again.', 
        variant: 'destructive' 
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Building2 className="h-4 w-4" />
          {count} selected
        </div>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-2">
              Bulk Actions
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => setShowRateDialog(true)}>
              <Percent className="h-4 w-4 mr-2" />
              Update Interest Rate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Calendar className="h-4 w-4 mr-2" />
              Set Rate Expiry Date
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button 
          size="sm" 
          variant="ghost" 
          onClick={onClearSelection}
          className="ml-auto"
        >
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      </div>

      <Dialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Interest Rate</DialogTitle>
            <DialogDescription>
              Set a new interest rate for {count} selected properties.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rate">New Interest Rate (%)</Label>
              <Input
                id="rate"
                type="number"
                step="0.01"
                min="0"
                max="20"
                placeholder="e.g. 5.25"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRates} disabled={isUpdating}>
              {isUpdating ? 'Updating...' : 'Update Rates'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
