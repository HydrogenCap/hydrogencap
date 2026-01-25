import React, { useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExtendableSelectProps {
  value: string | null;
  onValueChange: (value: string) => void;
  options: Array<{ id: string; name: string }>;
  placeholder?: string;
  addLabel?: string;
  dialogTitle?: string;
  dialogDescription?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  onAddNew: (name: string) => Promise<{ id: string; name: string }>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function ExtendableSelect({
  value,
  onValueChange,
  options,
  placeholder = 'Select...',
  addLabel = 'Add new',
  dialogTitle = 'Add New Item',
  dialogDescription = 'Enter the name for the new item.',
  inputLabel = 'Name',
  inputPlaceholder = 'Enter name...',
  onAddNew,
  isLoading = false,
  disabled = false,
}: ExtendableSelectProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddNew = async () => {
    if (!newName.trim()) {
      setError('Name is required');
      return;
    }

    setIsAdding(true);
    setError(null);

    try {
      const newItem = await onAddNew(newName.trim());
      onValueChange(newItem.id);
      setDialogOpen(false);
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSelectChange = (val: string) => {
    if (val === '__add_new__') {
      setDialogOpen(true);
    } else {
      onValueChange(val);
    }
  };

  return (
    <>
      <Select
        value={value || ''}
        onValueChange={handleSelectChange}
        disabled={disabled || isLoading}
      >
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className="bg-popover">
          {/* Add new option at top */}
          <SelectItem value="__add_new__" className="text-primary font-medium">
            <span className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              {addLabel}
            </span>
          </SelectItem>
          
          {options.length > 0 && (
            <div className="h-px bg-border my-1" />
          )}
          
          {options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">{inputLabel}</Label>
              <Input
                id="new-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={inputPlaceholder}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddNew();
                  }
                }}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setNewName('');
                setError(null);
              }}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button onClick={handleAddNew} disabled={isAdding}>
              {isAdding ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Add
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
