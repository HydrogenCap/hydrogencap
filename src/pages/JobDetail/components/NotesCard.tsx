import { format } from 'date-fns';
import { MessageSquare, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Note {
  id: string;
  note: string;
  created_at: string;
}

interface Props {
  notes: Note[] | undefined;
  newNote: string;
  setNewNote: (v: string) => void;
  addNote: { isPending: boolean };
  handleAddNote: () => void;
}

export function NotesCard({ notes, newNote, setNewNote, addNote, handleAddNote }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Notes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add a note..."
            rows={2}
            className="flex-1"
          />
          <Button onClick={handleAddNote} disabled={!newNote.trim() || addNote.isPending} size="sm">
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-3">
          {notes?.map(note => (
            <div key={note.id} className="p-3 bg-muted rounded-lg">
              <p className="text-sm">{note.note}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(note.created_at), 'dd MMM yyyy, HH:mm')}
              </p>
            </div>
          ))}
          {(!notes || notes.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notes yet
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
