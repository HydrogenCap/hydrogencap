import { useState, useCallback, useRef, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePropertyGaps, useRoomGaps, useTenantGaps, useTenancyGaps,
  useBatchUpdateProperties, useBatchUpdateRooms, useBatchUpdateTenants, useBatchUpdateTenancies,
} from '@/hooks/useMigration';
import { PROPERTY_TYPES, LIFECYCLE_STAGES } from '@/hooks/usePropertiesV2';
import { ROOM_TYPES } from '@/hooks/useRoomsV2';
import { cn } from '@/lib/utils';

function computeCompleteness(records: any[], fields: string[]): number {
  if (!records.length) return 100;
  const totalCells = records.length * fields.length;
  const filledCells = records.reduce((sum, r) => {
    return sum + fields.filter(f => r[f] !== null && r[f] !== undefined && r[f] !== '').length;
  }, 0);
  return Math.round((filledCells / totalCells) * 100);
}

function CellInput({ value, onChange, type = 'text', placeholder, isNull }: {
  value: any;
  onChange: (v: any) => void;
  type?: 'text' | 'number' | 'date';
  placeholder?: string;
  isNull?: boolean;
}) {
  return (
    <Input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(type === 'number' ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null))}
      placeholder={placeholder}
      className={cn(
        'h-8 text-xs border-0 bg-transparent focus-visible:ring-1 rounded-none',
        isNull && 'bg-warning/10'
      )}
    />
  );
}

function CellSelect({ value, onChange, options, isNull }: {
  value: string | null;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  isNull?: boolean;
}) {
  return (
    <Select value={value || ''} onValueChange={onChange}>
      <SelectTrigger className={cn('h-8 text-xs border-0 bg-transparent rounded-none', isNull && 'bg-warning/10')}>
        <SelectValue placeholder="Select..." />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CellToggle({ value, onChange, isNull }: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  isNull?: boolean;
}) {
  return (
    <div className={cn('flex items-center justify-center h-8', isNull && 'bg-warning/10')}>
      <Switch checked={value ?? false} onCheckedChange={onChange} className="scale-75" />
    </div>
  );
}

// ============================
// Properties Gap Fill
// ============================
function PropertiesGapFill() {
  const { data: properties, isLoading } = usePropertyGaps();
  const batchUpdate = useBatchUpdateProperties();
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({});

  const gapFields = ['has_gas_supply', 'year_built', 'total_lettable_rooms', 'total_floors', 'current_valuation', 'purchase_price', 'council_name', 'council_area'];
  const completeness = properties ? computeCompleteness(properties, gapFields) : 0;

  const setField = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const getVal = (record: any, field: string) => {
    return edits[record.id]?.[field] !== undefined ? edits[record.id][field] : record[field];
  };

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([id, fields]) => ({ id, ...fields }));
    if (!updates.length) return toast.info('No changes to save');
    try {
      await batchUpdate.mutateAsync(updates);
      setEdits({});
      toast.success(`Updated ${updates.length} properties`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Properties: {completeness}% complete</Badge>
        <Button size="sm" onClick={handleSave} disabled={batchUpdate.isPending || !Object.keys(edits).length}>
          {batchUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save Changes ({Object.keys(edits).length})
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[180px]">Address</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Gas?</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Year Built</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Rooms</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Floors</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Valuation (£)</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Purchase (£)</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Council</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Council Area</th>
            </tr>
          </thead>
          <tbody>
            {properties?.map(p => (
              <tr key={p.id} className="border-b hover:bg-muted/30">
                <td className="p-2 font-medium sticky left-0 bg-background">{p.address_line_1}, {p.postcode}</td>
                <td><CellToggle value={getVal(p, 'has_gas_supply')} onChange={v => setField(p.id, 'has_gas_supply', v)} isNull={p.has_gas_supply === null} /></td>
                <td><CellInput value={getVal(p, 'year_built')} onChange={v => setField(p.id, 'year_built', v)} type="number" placeholder="e.g. 1920" isNull={p.year_built === null} /></td>
                <td><CellInput value={getVal(p, 'total_lettable_rooms')} onChange={v => setField(p.id, 'total_lettable_rooms', v)} type="number" isNull={p.total_lettable_rooms === null} /></td>
                <td><CellInput value={getVal(p, 'total_floors')} onChange={v => setField(p.id, 'total_floors', v)} type="number" isNull={p.total_floors === null} /></td>
                <td><CellInput value={getVal(p, 'current_valuation')} onChange={v => setField(p.id, 'current_valuation', v)} type="number" placeholder="£" isNull={p.current_valuation === null} /></td>
                <td><CellInput value={getVal(p, 'purchase_price')} onChange={v => setField(p.id, 'purchase_price', v)} type="number" placeholder="£" isNull={p.purchase_price === null} /></td>
                <td><CellInput value={getVal(p, 'council_name')} onChange={v => setField(p.id, 'council_name', v)} placeholder="Council" isNull={p.council_name === null} /></td>
                <td><CellInput value={getVal(p, 'council_area')} onChange={v => setField(p.id, 'council_area', v)} placeholder="Area" isNull={p.council_area === null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================
// Rooms Gap Fill
// ============================
function RoomsGapFill() {
  const { data: rooms, isLoading } = useRoomGaps();
  const batchUpdate = useBatchUpdateRooms();
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({});

  const gapFields = ['current_rent_pcm', 'target_rent_pcm', 'has_ensuite', 'floor'];
  const completeness = rooms ? computeCompleteness(rooms, gapFields) : 0;

  const setField = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getVal = (record: any, field: string) => edits[record.id]?.[field] !== undefined ? edits[record.id][field] : record[field];

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([id, fields]) => ({ id, ...fields }));
    if (!updates.length) return toast.info('No changes to save');
    try {
      await batchUpdate.mutateAsync(updates);
      setEdits({});
      toast.success(`Updated ${updates.length} rooms`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Rooms: {completeness}% complete</Badge>
        <Button size="sm" onClick={handleSave} disabled={batchUpdate.isPending || !Object.keys(edits).length}>
          {batchUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save ({Object.keys(edits).length})
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[200px]">Property / Room</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Type</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Rent PCM (£)</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Target PCM (£)</th>
              <th className="text-left p-2 font-medium min-w-[80px]">En-suite?</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Lettable?</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Floor</th>
            </tr>
          </thead>
          <tbody>
            {rooms?.map((r: any) => (
              <tr key={r.id} className="border-b hover:bg-muted/30">
                <td className="p-2 font-medium sticky left-0 bg-background">
                  <div className="text-[10px] text-muted-foreground">{r.property_address}</div>
                  <div>{r.room_name}</div>
                </td>
                <td><CellSelect value={getVal(r, 'room_type')} onChange={v => setField(r.id, 'room_type', v)} options={[...ROOM_TYPES]} /></td>
                <td><CellInput value={getVal(r, 'current_rent_pcm')} onChange={v => setField(r.id, 'current_rent_pcm', v)} type="number" isNull={r.current_rent_pcm === null} /></td>
                <td><CellInput value={getVal(r, 'target_rent_pcm')} onChange={v => setField(r.id, 'target_rent_pcm', v)} type="number" isNull={r.target_rent_pcm === null} /></td>
                <td><CellToggle value={getVal(r, 'has_ensuite')} onChange={v => setField(r.id, 'has_ensuite', v)} /></td>
                <td><CellToggle value={getVal(r, 'is_lettable')} onChange={v => setField(r.id, 'is_lettable', v)} /></td>
                <td><CellInput value={getVal(r, 'floor')} onChange={v => setField(r.id, 'floor', v)} type="number" isNull={r.floor === null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================
// Tenants Gap Fill
// ============================
function TenantsGapFill() {
  const { data: tenants, isLoading } = useTenantGaps();
  const batchUpdate = useBatchUpdateTenants();
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({});

  const gapFields = ['email', 'phone', 'date_of_birth', 'national_insurance', 'emergency_contact_name', 'emergency_contact_phone'];
  const completeness = tenants ? computeCompleteness(tenants, gapFields) : 0;

  const setField = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getVal = (record: any, field: string) => edits[record.id]?.[field] !== undefined ? edits[record.id][field] : record[field];

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([id, fields]) => ({ id, ...fields }));
    if (!updates.length) return toast.info('No changes to save');
    try {
      await batchUpdate.mutateAsync(updates);
      setEdits({});
      toast.success(`Updated ${updates.length} tenants`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Tenants: {completeness}% complete</Badge>
        <Button size="sm" onClick={handleSave} disabled={batchUpdate.isPending || !Object.keys(edits).length}>
          {batchUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save ({Object.keys(edits).length})
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium sticky left-0 bg-muted/50 min-w-[150px]">Name</th>
              <th className="text-left p-2 font-medium min-w-[150px]">Email</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Phone</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Date of Birth</th>
              <th className="text-left p-2 font-medium min-w-[120px]">NI Number</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Emergency Name</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Emergency Phone</th>
            </tr>
          </thead>
          <tbody>
            {tenants?.map((t: any) => (
              <tr key={t.id} className="border-b hover:bg-muted/30">
                <td className="p-2 font-medium sticky left-0 bg-background">{t.first_name} {t.last_name}</td>
                <td><CellInput value={getVal(t, 'email')} onChange={v => setField(t.id, 'email', v)} placeholder="email" isNull={t.email === null} /></td>
                <td><CellInput value={getVal(t, 'phone')} onChange={v => setField(t.id, 'phone', v)} placeholder="phone" isNull={t.phone === null} /></td>
                <td><CellInput value={getVal(t, 'date_of_birth')} onChange={v => setField(t.id, 'date_of_birth', v)} type="date" isNull={t.date_of_birth === null} /></td>
                <td><CellInput value={getVal(t, 'national_insurance')} onChange={v => setField(t.id, 'national_insurance', v)} placeholder="NI" isNull={t.national_insurance === null} /></td>
                <td><CellInput value={getVal(t, 'emergency_contact_name')} onChange={v => setField(t.id, 'emergency_contact_name', v)} isNull={t.emergency_contact_name === null} /></td>
                <td><CellInput value={getVal(t, 'emergency_contact_phone')} onChange={v => setField(t.id, 'emergency_contact_phone', v)} isNull={t.emergency_contact_phone === null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================
// Tenancy Agreements Gap Fill
// ============================
function TenancyGapFill() {
  const { data: tenancies, isLoading } = useTenancyGaps();
  const batchUpdate = useBatchUpdateTenancies();
  const [edits, setEdits] = useState<Record<string, Record<string, any>>>({});

  const gapFields = ['deposit_amount', 'deposit_scheme', 'deposit_protected_date', 'how_to_rent_served_date', 'prescribed_info_served_date'];
  const completeness = tenancies ? computeCompleteness(tenancies, gapFields) : 0;

  const TENANCY_TYPES = [
    { value: 'ast', label: 'AST' },
    { value: 'non_ast', label: 'Non-AST' },
    { value: 'licence', label: 'Licence' },
    { value: 'company_let', label: 'Company Let' },
  ];
  const DEPOSIT_SCHEMES = [
    { value: 'DPS', label: 'DPS' },
    { value: 'MyDeposits', label: 'MyDeposits' },
    { value: 'TDS', label: 'TDS' },
  ];

  const setField = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };
  const getVal = (record: any, field: string) => edits[record.id]?.[field] !== undefined ? edits[record.id][field] : record[field];

  const handleSave = async () => {
    const updates = Object.entries(edits).map(([id, fields]) => ({ id, ...fields }));
    if (!updates.length) return toast.info('No changes to save');
    try {
      await batchUpdate.mutateAsync(updates);
      setEdits({});
      toast.success(`Updated ${updates.length} tenancies`);
    } catch (e: any) { toast.error(e.message); }
  };

  if (isLoading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">Active Tenancies: {completeness}% complete</Badge>
        <Button size="sm" onClick={handleSave} disabled={batchUpdate.isPending || !Object.keys(edits).length}>
          {batchUpdate.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
          Save ({Object.keys(edits).length})
        </Button>
      </div>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-2 font-medium min-w-[100px]">Type</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Rent PCM (£)</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Deposit (£)</th>
              <th className="text-left p-2 font-medium min-w-[100px]">Scheme</th>
              <th className="text-left p-2 font-medium min-w-[80px]">Deposit Ref</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Deposit Protected</th>
              <th className="text-left p-2 font-medium min-w-[120px]">How to Rent</th>
              <th className="text-left p-2 font-medium min-w-[120px]">Prescribed Info</th>
            </tr>
          </thead>
          <tbody>
            {tenancies?.map((t: any) => (
              <tr key={t.id} className="border-b hover:bg-muted/30">
                <td><CellSelect value={getVal(t, 'tenancy_type')} onChange={v => setField(t.id, 'tenancy_type', v)} options={TENANCY_TYPES} /></td>
                <td><CellInput value={getVal(t, 'rent_amount_pcm')} onChange={v => setField(t.id, 'rent_amount_pcm', v)} type="number" /></td>
                <td><CellInput value={getVal(t, 'deposit_amount')} onChange={v => setField(t.id, 'deposit_amount', v)} type="number" isNull={t.deposit_amount === null} /></td>
                <td><CellSelect value={getVal(t, 'deposit_scheme')} onChange={v => setField(t.id, 'deposit_scheme', v)} options={DEPOSIT_SCHEMES} isNull={t.deposit_scheme === null} /></td>
                <td><CellInput value={getVal(t, 'deposit_reference')} onChange={v => setField(t.id, 'deposit_reference', v)} isNull={t.deposit_reference === null} /></td>
                <td><CellInput value={getVal(t, 'deposit_protected_date')} onChange={v => setField(t.id, 'deposit_protected_date', v)} type="date" isNull={t.deposit_protected_date === null} /></td>
                <td><CellInput value={getVal(t, 'how_to_rent_served_date')} onChange={v => setField(t.id, 'how_to_rent_served_date', v)} type="date" isNull={t.how_to_rent_served_date === null} /></td>
                <td><CellInput value={getVal(t, 'prescribed_info_served_date')} onChange={v => setField(t.id, 'prescribed_info_served_date', v)} type="date" isNull={t.prescribed_info_served_date === null} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================
// Main Gap Fill Section
// ============================
export function GapFillSection() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4">
          <h2 className="font-semibold text-sm">Fill Missing Data</h2>
          <p className="text-xs text-muted-foreground mt-1">
            After migration, fill in fields that V1 didn't capture. Amber cells indicate missing values.
          </p>
        </div>
        <Tabs defaultValue="properties">
          <TabsList className="mb-4">
            <TabsTrigger value="properties" className="text-xs">Properties</TabsTrigger>
            <TabsTrigger value="rooms" className="text-xs">Rooms</TabsTrigger>
            <TabsTrigger value="tenants" className="text-xs">Tenants</TabsTrigger>
            <TabsTrigger value="tenancies" className="text-xs">Tenancies</TabsTrigger>
          </TabsList>
          <TabsContent value="properties"><PropertiesGapFill /></TabsContent>
          <TabsContent value="rooms"><RoomsGapFill /></TabsContent>
          <TabsContent value="tenants"><TenantsGapFill /></TabsContent>
          <TabsContent value="tenancies"><TenancyGapFill /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
