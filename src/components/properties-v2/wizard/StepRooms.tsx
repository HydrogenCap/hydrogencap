import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Wand2 } from 'lucide-react';
import { ROOM_TYPES } from '@/hooks/useRoomsV2';
import type { WizardData, WizardRoom } from './types';

interface Props {
  data: WizardData;
  onChange: (partial: Partial<WizardData>) => void;
}

export function StepRooms({ data, onChange }: Props) {
  const [quickCount, setQuickCount] = useState('');
  const [quickType, setQuickType] = useState('double');
  const [quickRent, setQuickRent] = useState('');

  const rooms = data.rooms;

  const generateRooms = () => {
    const count = parseInt(quickCount) || 0;
    if (count <= 0) return;
    const rent = parseFloat(quickRent) || null;
    const existing = rooms.length;
    const newRooms: WizardRoom[] = Array.from({ length: count }, (_, i) => ({
      room_name: `Room ${existing + i + 1}`,
      room_type: quickType,
      floor: 0,
      has_ensuite: quickType === 'ensuite',
      is_lettable: true,
      target_rent_pcm: rent,
    }));
    onChange({ rooms: [...rooms, ...newRooms] });
    setQuickCount('');
  };

  const updateRoom = (idx: number, partial: Partial<WizardRoom>) => {
    const updated = rooms.map((r, i) => i === idx ? { ...r, ...partial } : r);
    onChange({ rooms: updated });
  };

  const removeRoom = (idx: number) => {
    onChange({ rooms: rooms.filter((_, i) => i !== idx) });
  };

  const addRoom = (lettable: boolean) => {
    const name = lettable ? `Room ${rooms.filter(r => r.is_lettable).length + 1}` : 'Communal Area';
    onChange({
      rooms: [...rooms, {
        room_name: name,
        room_type: lettable ? 'double' : 'communal',
        floor: 0,
        has_ensuite: false,
        is_lettable: lettable,
        target_rent_pcm: null,
      }],
    });
  };

  const lettableRooms = rooms.filter(r => r.is_lettable);
  const totalMonthly = lettableRooms.reduce((s, r) => s + (r.target_rent_pcm || 0), 0);

  const fmtGBP = (v: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);

  return (
    <div className="space-y-6">
      {/* Quick-add */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-3">
        <h4 className="text-sm font-semibold">Quick Add Rooms</h4>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs">How many?</Label>
            <Input type="number" min="1" value={quickCount} onChange={e => setQuickCount(e.target.value)} className="w-20" placeholder="5" />
          </div>
          <div>
            <Label className="text-xs">Default type</Label>
            <Select value={quickType} onValueChange={setQuickType}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOM_TYPES.filter(t => t.value !== 'communal').map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rent £/mo</Label>
            <Input type="number" value={quickRent} onChange={e => setQuickRent(e.target.value)} className="w-24" placeholder="550" />
          </div>
          <Button onClick={generateRooms} variant="secondary" size="sm" disabled={!quickCount}>
            <Wand2 className="h-4 w-4 mr-1" /> Generate
          </Button>
        </div>
      </div>

      {/* Room table */}
      {rooms.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-16">Floor</TableHead>
                <TableHead className="w-20">Ensuite</TableHead>
                <TableHead className="w-28">Rent £/mo</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r, i) => (
                <TableRow key={i} className={!r.is_lettable ? 'bg-muted/30' : ''}>
                  <TableCell>
                    <Input value={r.room_name} onChange={e => updateRoom(i, { room_name: e.target.value })} className="h-8 text-sm" />
                  </TableCell>
                  <TableCell>
                    <Select value={r.room_type} onValueChange={v => updateRoom(i, { room_type: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={r.floor} onChange={e => updateRoom(i, { floor: parseInt(e.target.value) || 0 })} className="h-8 text-sm w-16" />
                  </TableCell>
                  <TableCell>
                    <Checkbox checked={r.has_ensuite} onCheckedChange={v => updateRoom(i, { has_ensuite: !!v })} />
                  </TableCell>
                  <TableCell>
                    {r.is_lettable ? (
                      <Input type="number" value={r.target_rent_pcm ?? ''} onChange={e => updateRoom(i, { target_rent_pcm: parseFloat(e.target.value) || null })} className="h-8 text-sm" placeholder="550" />
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button aria-label="Delete" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRoom(i)}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => addRoom(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Room
        </Button>
        <Button variant="outline" size="sm" onClick={() => addRoom(false)}>
          <Plus className="h-4 w-4 mr-1" /> Add Communal Area
        </Button>
      </div>

      {/* Summary */}
      {lettableRooms.length > 0 && (
        <div className="bg-muted/50 rounded-lg p-4 flex gap-6 text-sm">
          <div><span className="text-muted-foreground">Lettable rooms:</span> <span className="font-semibold">{lettableRooms.length}</span></div>
          <div><span className="text-muted-foreground">Monthly rent:</span> <span className="font-semibold">{fmtGBP(totalMonthly)}</span></div>
          <div><span className="text-muted-foreground">Annual gross:</span> <span className="font-semibold">{fmtGBP(totalMonthly * 12)}</span></div>
        </div>
      )}
    </div>
  );
}
