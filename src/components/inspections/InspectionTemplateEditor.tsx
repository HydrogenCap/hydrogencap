import { useState } from 'react';
import { Plus, Trash2, GripVertical, Copy, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  useInspectionTemplates,
  useCreateInspectionTemplate,
  useUpdateInspectionTemplate,
  useDeleteInspectionTemplate,
  DEFAULT_TEMPLATES,
  INSPECTION_TYPES,
  type InspectionTemplate,
  type InspectionTemplateRoom,
} from '@/hooks/useInspections';

interface RoomEditor {
  room_name: string;
  items: { item_name: string; sort_order: number }[];
}

export function InspectionTemplateEditor() {
  const { data: templates = [], isLoading } = useInspectionTemplates();
  const createTemplate = useCreateInspectionTemplate();
  const updateTemplate = useUpdateInspectionTemplate();
  const deleteTemplate = useDeleteInspectionTemplate();

  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InspectionTemplate | null>(null);
  const [name, setName] = useState('');
  const [inspectionType, setInspectionType] = useState('periodic');
  const [rooms, setRooms] = useState<RoomEditor[]>([]);

  // Drag state
  const [dragRoomIndex, setDragRoomIndex] = useState<number | null>(null);
  const [dragOverRoomIndex, setDragOverRoomIndex] = useState<number | null>(null);

  const openNew = () => {
    setEditingTemplate(null);
    setName('');
    setInspectionType('periodic');
    setRooms([{ room_name: '', items: [{ item_name: '', sort_order: 0 }] }]);
    setShowEditor(true);
  };

  const openEdit = (template: InspectionTemplate) => {
    setEditingTemplate(template);
    setName(template.name);
    setInspectionType(template.inspection_type);
    setRooms(template.rooms.map(r => ({
      room_name: r.room_name,
      items: r.items.map(i => ({ ...i })),
    })));
    setShowEditor(true);
  };

  const loadDefault = (defaultTemplate: typeof DEFAULT_TEMPLATES[number]) => {
    setEditingTemplate(null);
    setName(defaultTemplate.name);
    setInspectionType(defaultTemplate.inspection_type);
    setRooms(defaultTemplate.rooms.map(r => ({
      room_name: r.room_name,
      items: r.items.map(i => ({ ...i })),
    })));
    setShowEditor(true);
  };

  const addRoom = () => {
    setRooms(prev => [...prev, { room_name: '', items: [{ item_name: '', sort_order: 0 }] }]);
  };

  const removeRoom = (index: number) => {
    setRooms(prev => prev.filter((_, i) => i !== index));
  };

  const updateRoomName = (index: number, name: string) => {
    setRooms(prev => prev.map((r, i) => i === index ? { ...r, room_name: name } : r));
  };

  const addItem = (roomIndex: number) => {
    setRooms(prev => prev.map((r, i) =>
      i === roomIndex
        ? { ...r, items: [...r.items, { item_name: '', sort_order: r.items.length }] }
        : r
    ));
  };

  const removeItem = (roomIndex: number, itemIndex: number) => {
    setRooms(prev => prev.map((r, i) =>
      i === roomIndex
        ? { ...r, items: r.items.filter((_, j) => j !== itemIndex) }
        : r
    ));
  };

  const updateItemName = (roomIndex: number, itemIndex: number, name: string) => {
    setRooms(prev => prev.map((r, i) =>
      i === roomIndex
        ? { ...r, items: r.items.map((item, j) => j === itemIndex ? { ...item, item_name: name } : item) }
        : r
    ));
  };

  // Drag and drop handlers for rooms
  const handleDragStart = (index: number) => {
    setDragRoomIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverRoomIndex(index);
  };

  const handleDrop = (index: number) => {
    if (dragRoomIndex === null || dragRoomIndex === index) return;
    setRooms(prev => {
      const updated = [...prev];
      const [moved] = updated.splice(dragRoomIndex, 1);
      updated.splice(index, 0, moved);
      return updated;
    });
    setDragRoomIndex(null);
    setDragOverRoomIndex(null);
  };

  const handleDragEnd = () => {
    setDragRoomIndex(null);
    setDragOverRoomIndex(null);
  };

  const handleSave = async () => {
    const cleanedRooms: InspectionTemplateRoom[] = rooms
      .filter(r => r.room_name.trim())
      .map(r => ({
        room_name: r.room_name.trim(),
        items: r.items
          .filter(i => i.item_name.trim())
          .map((i, idx) => ({ item_name: i.item_name.trim(), sort_order: idx })),
      }));

    if (!name.trim() || cleanedRooms.length === 0) return;

    if (editingTemplate) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        name: name.trim(),
        inspection_type: inspectionType,
        rooms: cleanedRooms,
      });
    } else {
      await createTemplate.mutateAsync({
        name: name.trim(),
        inspection_type: inspectionType,
        rooms: cleanedRooms,
      });
    }

    setShowEditor(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspection Templates</h2>
          <p className="text-sm text-muted-foreground">
            Create reusable room-by-room checklists
          </p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Default templates to quick-add */}
      {templates.length === 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Start Templates</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {DEFAULT_TEMPLATES.map(t => (
                <Card key={t.name} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => loadDefault(t)}>
                  <CardContent className="p-4">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.rooms.length} rooms, {t.rooms.reduce((sum, r) => sum + r.items.length, 0)} items
                    </p>
                    <Badge variant="secondary" className="mt-2 text-xs">
                      {INSPECTION_TYPES.find(it => it.value === t.inspection_type)?.label}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Existing templates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <Card key={template.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {INSPECTION_TYPES.find(t => t.value === template.inspection_type)?.label}
                  </Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(template)}>
                    <Save className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(template.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {template.rooms.map(room => (
                  <div key={room.room_name} className="text-xs">
                    <span className="font-medium">{room.room_name}</span>
                    <span className="text-muted-foreground"> ({room.items.length} items)</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Template Editor Dialog */}
      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              Define the sections and questions used for periodic inspections.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input
                  placeholder="e.g. Standard HMO Inspection"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Inspection Type</Label>
                <Select value={inspectionType} onValueChange={setInspectionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INSPECTION_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* Rooms */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base">Rooms</Label>
                <Button variant="outline" size="sm" onClick={addRoom} className="gap-1">
                  <Plus className="h-3 w-3" />
                  Add Room
                </Button>
              </div>

              {rooms.map((room, roomIndex) => (
                <Card
                  key={roomIndex}
                  draggable
                  onDragStart={() => handleDragStart(roomIndex)}
                  onDragOver={e => handleDragOver(e, roomIndex)}
                  onDrop={() => handleDrop(roomIndex)}
                  onDragEnd={handleDragEnd}
                  className={dragOverRoomIndex === roomIndex ? 'border-primary' : ''}
                >
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab shrink-0" />
                      <Input
                        placeholder="Room name (e.g. Kitchen)"
                        value={room.room_name}
                        onChange={e => updateRoomName(roomIndex, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive shrink-0"
                        onClick={() => removeRoom(roomIndex)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="ml-6 space-y-2">
                      {room.items.map((item, itemIndex) => (
                        <div key={itemIndex} className="flex items-center gap-2">
                          <Input
                            placeholder="Item name (e.g. Walls, Ceiling)"
                            value={item.item_name}
                            onChange={e => updateItemName(roomIndex, itemIndex, e.target.value)}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                            onClick={() => removeItem(roomIndex, itemIndex)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => addItem(roomIndex)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowEditor(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || rooms.filter(r => r.room_name.trim()).length === 0 || createTemplate.isPending || updateTemplate.isPending}
              >
                {(createTemplate.isPending || updateTemplate.isPending) ? 'Saving...' : 'Save Template'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
