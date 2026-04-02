import { useState, useMemo, useRef } from 'react';
import { Camera, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp, ImagePlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  useInspectionItems,
  useUpdateInspectionItem,
  CONDITION_RATINGS,
  type InspectionItem,
  type ItemCondition,
} from '@/hooks/useInspections';

interface InspectionChecklistProps {
  inspectionId: string;
}

export function InspectionChecklist({ inspectionId }: InspectionChecklistProps) {
  const { data: items = [], isLoading } = useInspectionItems(inspectionId);
  const updateItem = useUpdateInspectionItem();
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activePhotoItemId, setActivePhotoItemId] = useState<string | null>(null);

  // Group items by room
  const roomGroups = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};
    for (const item of items) {
      if (!groups[item.room_name]) groups[item.room_name] = [];
      groups[item.room_name].push(item);
    }
    return Object.entries(groups).sort(([, a], [, b]) =>
      (a[0]?.sort_order ?? 0) - (b[0]?.sort_order ?? 0)
    );
  }, [items]);

  // Progress tracking
  const totalItems = items.length;
  const checkedItems = items.filter(i => i.condition !== null).length;
  const progressPercent = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0;
  const actionsRequired = items.filter(i => i.action_required).length;

  const toggleRoom = (room: string) => {
    setExpandedRooms(prev => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };

  const handleConditionChange = (item: InspectionItem, condition: ItemCondition) => {
    updateItem.mutate({
      id: item.id,
      inspection_id: item.inspection_id,
      condition,
    });
  };

  const handleNotesChange = (item: InspectionItem, notes: string) => {
    updateItem.mutate({
      id: item.id,
      inspection_id: item.inspection_id,
      notes: notes || null,
    });
  };

  const handleActionToggle = (item: InspectionItem, actionRequired: boolean) => {
    updateItem.mutate({
      id: item.id,
      inspection_id: item.inspection_id,
      action_required: actionRequired,
    });
  };

  const handleActionDescription = (item: InspectionItem, description: string) => {
    updateItem.mutate({
      id: item.id,
      inspection_id: item.inspection_id,
      action_description: description || null,
    });
  };

  const handlePhotoUpload = (item: InspectionItem) => {
    setActivePhotoItemId(item.id);
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activePhotoItemId) return;

    // In production this would upload to Supabase Storage
    // For now, create a local object URL as placeholder
    const url = URL.createObjectURL(file);
    const item = items.find(i => i.id === activePhotoItemId);
    if (!item) return;

    const newPhotos = [
      ...item.photos,
      { url, description: file.name, taken_at: new Date().toISOString() },
    ];

    updateItem.mutate({
      id: item.id,
      inspection_id: item.inspection_id,
      photos: newPhotos as any,
    });

    setActivePhotoItemId(null);
    e.target.value = '';
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading checklist...
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No checklist items. Apply a template to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">
              {checkedItems} of {totalItems} items checked
            </span>
            <div className="flex items-center gap-3">
              {actionsRequired > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {actionsRequired} actions
                </Badge>
              )}
              <span className="text-sm text-muted-foreground">{progressPercent}%</span>
            </div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Hidden file input for photo uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Room sections */}
      {roomGroups.map(([roomName, roomItems]) => {
        const roomChecked = roomItems.filter(i => i.condition !== null).length;
        const isExpanded = expandedRooms.has(roomName);

        return (
          <Card key={roomName}>
            <CardHeader
              className="cursor-pointer select-none pb-3"
              onClick={() => toggleRoom(roomName)}
            >
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  {roomName}
                  <Badge variant="secondary" className="text-xs">
                    {roomChecked}/{roomItems.length}
                  </Badge>
                  {roomChecked === roomItems.length && roomItems.length > 0 && (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  )}
                </CardTitle>
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent className="space-y-4 pt-0">
                {roomItems.map(item => (
                  <div
                    key={item.id}
                    className={cn(
                      'rounded-lg border p-4 space-y-3',
                      item.action_required && 'border-orange-500/50 bg-orange-50/50 dark:bg-orange-950/10',
                      item.condition && !item.action_required && 'border-green-500/20',
                    )}
                  >
                    {/* Item header */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.item_name}</span>
                      <Select
                        value={item.condition || ''}
                        onValueChange={v => handleConditionChange(item, v as ItemCondition)}
                      >
                        <SelectTrigger className="w-32 h-9">
                          <SelectValue placeholder="Condition" />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDITION_RATINGS.map(c => (
                            <SelectItem key={c.value} value={c.value}>
                              <span className={cn('px-1 rounded', c.color)}>{c.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Notes */}
                    <Textarea
                      placeholder="Notes..."
                      value={item.notes || ''}
                      onChange={e => handleNotesChange(item, e.target.value)}
                      rows={2}
                      className="text-sm min-h-[60px]"
                    />

                    {/* Photos */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {item.photos.map((photo, idx) => (
                        <div key={idx} className="relative h-16 w-16 rounded-md overflow-hidden border">
                          <img
                            src={photo.url}
                            alt={photo.description || `Photo ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-16 w-16 flex-col gap-1"
                        onClick={() => handlePhotoUpload(item)}
                      >
                        <Camera className="h-5 w-5" />
                        <span className="text-[10px]">Photo</span>
                      </Button>
                    </div>

                    {/* Action required */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={item.action_required}
                          onCheckedChange={v => handleActionToggle(item, v)}
                        />
                        <Label className="text-sm text-muted-foreground">Action Required</Label>
                      </div>
                    </div>
                    {item.action_required && (
                      <Input
                        placeholder="Describe action needed..."
                        value={item.action_description || ''}
                        onChange={e => handleActionDescription(item, e.target.value)}
                        className="text-sm"
                      />
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
