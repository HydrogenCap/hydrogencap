import { Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function NotesCard({ state }: { state: RoomDetailState }) {
  const { room, editingNotes, setEditingNotes, notesValue, setNotesValue, handleSaveNotes, updateRoomPending } = state;
  if (!room) return null;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notes</CardTitle>
        {!editingNotes && (
          <Button variant="ghost" size="sm" onClick={() => { setNotesValue(room.notes || ''); setEditingNotes(true); }}>
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {editingNotes ? (
          <div className="space-y-2">
            <Textarea value={notesValue} onChange={e => setNotesValue(e.target.value)} rows={4} />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setEditingNotes(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSaveNotes} disabled={updateRoomPending}>Save</Button>
            </div>
          </div>
        ) : (
          <p className={room.notes ? 'text-foreground' : 'text-muted-foreground'}>{room.notes || 'No notes'}</p>
        )}
      </CardContent>
    </Card>
  );
}
