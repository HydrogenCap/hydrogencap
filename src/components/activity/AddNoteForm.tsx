import { useState } from 'react';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ActivityLoggers } from '@/hooks/useActivityLog';
import { useQueryClient } from '@tanstack/react-query';

interface AddNoteFormProps {
  propertyId: string;
}

export function AddNoteForm({ propertyId }: AddNoteFormProps) {
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedNote = note.trim();
    if (!trimmedNote) return;

    setIsSubmitting(true);
    try {
      await ActivityLoggers.noteAdded(propertyId, trimmedNote);
      setNote('');
      toast({
        title: 'Note added',
        description: 'Your note has been added to the timeline.',
      });
      // Invalidate activity log queries to refresh the timeline
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
      queryClient.invalidateQueries({ queryKey: ['activity_log', propertyId] });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to add note. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        placeholder="Add a note about this property..."
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="min-h-[80px] resize-none bg-background"
        disabled={isSubmitting}
      />
      <div className="flex justify-end">
        <Button 
          type="submit" 
          size="sm" 
          disabled={!note.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <MessageSquarePlus className="h-4 w-4 mr-2" />
          )}
          Add Note
        </Button>
      </div>
    </form>
  );
}
