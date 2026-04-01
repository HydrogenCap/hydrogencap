import React, { useState } from 'react';
import { Plus, X, FileText, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useTitleNumbers, useAddTitleNumber, useRemoveTitleNumber, TitleNumber } from '@/hooks/useCoreIdentity';
import { useToast } from '@/hooks/use-toast';

interface MultiTitleNumberInputProps {
  propertyId: string;
}

export function MultiTitleNumberInput({ propertyId }: MultiTitleNumberInputProps) {
  const { toast } = useToast();
  const { data: titleNumbers = [], isLoading } = useTitleNumbers(propertyId);
  const addTitleNumber = useAddTitleNumber();
  const removeTitleNumber = useRemoveTitleNumber();
  
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAdd = async () => {
    const trimmed = newTitle.trim().toUpperCase();
    if (!trimmed) return;
    
    // Check for duplicates
    if (titleNumbers.some(t => t.title_number === trimmed)) {
      toast({
        title: 'Duplicate title number',
        description: 'This title number has already been added.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addTitleNumber.mutateAsync({ propertyId, titleNumber: trimmed });
      setNewTitle('');
      setIsAdding(false);
      toast({
        title: 'Title number added',
        description: `${trimmed} has been added.`,
      });
    } catch (error) {
      console.error('Failed to add title number:', error);
      toast({
        title: 'Error',
        description: 'Failed to add title number.',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async (id: string, titleNumber: string) => {
    try {
      await removeTitleNumber.mutateAsync({ id, propertyId });
      toast({
        title: 'Title number removed',
        description: `${titleNumber} has been removed.`,
      });
    } catch (error) {
      console.error('Failed to remove title number:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove title number.',
        variant: 'destructive',
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
    if (e.key === 'Escape') {
      setNewTitle('');
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading title numbers...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Title Numbers</Label>
        {titleNumbers.length === 0 && !isAdding && (
          <span className="text-xs text-warning">Recommended</span>
        )}
      </div>
      
      {/* Existing title numbers */}
      {titleNumbers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {titleNumbers.map((title) => (
            <Badge 
              key={title.id} 
              variant="secondary" 
              className="gap-1.5 pr-1.5 py-1 text-sm font-mono"
            >
              <FileText className="h-3 w-3" />
              {title.title_number}
              <button
                type="button"
                onClick={() => handleRemove(title.id, title.title_number)}
                className="ml-1 rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
                disabled={removeTitleNumber.isPending}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      
      {/* Add new input */}
      {isAdding ? (
        <div className="flex gap-2">
          <Input
            placeholder="e.g. NGL123456"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value.toUpperCase())}
            onKeyDown={handleKeyDown}
            className="font-mono uppercase"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAdd}
            disabled={!newTitle.trim() || addTitleNumber.isPending}
          >
            {addTitleNumber.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Add'
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setNewTitle('');
              setIsAdding(false);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Title Number
        </Button>
      )}
      
      <p className="text-xs text-muted-foreground">
        Land Registry title numbers for this property. Multiple titles may apply to complex sites.
      </p>
    </div>
  );
}
