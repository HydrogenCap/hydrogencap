import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  Plus, ArrowUpDown, Download, MapPin, Trash2, Home, Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  useValuationComparables,
  useCreateValuationComparable,
  useDeleteValuationComparable,
  type ValuationComparableInsert,
} from '@/hooks/useValuationEvidence';

interface ComparableEvidenceLogProps {
  propertyId: string;
}

type SortField = 'sale_date' | 'sale_price' | 'price_per_sqm' | 'distance_miles';

const SOURCE_LABELS: Record<string, string> = {
  land_registry: 'Land Registry',
  rightmove: 'Rightmove',
  agent: 'Agent',
  manual: 'Manual',
};

const SOURCE_COLOURS: Record<string, string> = {
  land_registry: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  rightmove: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  agent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  manual: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

const EMPTY_FORM: Omit<ValuationComparableInsert, 'property_id'> = {
  comp_address: '',
  comp_postcode: '',
  sale_price: 0,
  sale_date: new Date().toISOString().split('T')[0],
  property_type: '',
  beds: null,
  sqm: null,
  price_per_sqm: null,
  distance_miles: null,
  source: 'manual',
  notes: null,
};

export function ComparableEvidenceLog({ propertyId }: ComparableEvidenceLogProps) {
  const { data: comparables, isLoading } = useValuationComparables(propertyId);
  const createComp = useCreateValuationComparable();
  const deleteComp = useDeleteValuationComparable();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sortField, setSortField] = useState<SortField>('sale_date');
  const [sortAsc, setSortAsc] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    if (!comparables) return [];
    let rows = [...comparables];
    if (sourceFilter !== 'all') rows = rows.filter((c) => c.source === sourceFilter);
    rows.sort((a, b) => {
      const av = a[sortField] ?? -Infinity;
      const bv = b[sortField] ?? -Infinity;
      if (typeof av === 'string' && typeof bv === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? Number(av) - Number(bv) : Number(bv) - Number(av);
    });
    return rows;
  }, [comparables, sortField, sortAsc, sourceFilter]);

  const avgValue = useMemo(() => {
    if (!filtered.length) return null;
    return Math.round(filtered.reduce((s, c) => s + c.sale_price, 0) / filtered.length);
  }, [filtered]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(false); }
  };

  const handleSubmit = () => {
    const pricePerSqm = form.sqm && form.sqm > 0 ? Math.round(form.sale_price / form.sqm) : form.price_per_sqm;
    createComp.mutate(
      { ...form, property_id: propertyId, price_per_sqm: pricePerSqm },
      { onSuccess: () => { setShowAdd(false); setForm(EMPTY_FORM); } },
    );
  };

  const handleExportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Address', 'Postcode', 'Price', 'Date', 'Type', 'Beds', 'Sqm', '£/sqm', 'Distance (mi)', 'Source', 'Notes'];
    const rows = filtered.map((c) => [
      c.comp_address, c.comp_postcode ?? '', c.sale_price, c.sale_date,
      c.property_type ?? '', c.beds ?? '', c.sqm ?? '', c.price_per_sqm ?? '',
      c.distance_miles ?? '', SOURCE_LABELS[c.source] ?? c.source, c.notes ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `comparables-${propertyId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Comparable Evidence</CardTitle></CardHeader>
        <CardContent><div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}</div></CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Comparable Evidence</CardTitle>
              <CardDescription>
                {filtered.length} comparable{filtered.length !== 1 ? 's' : ''}
                {avgValue != null && <> &bull; Average: {fmtGBP(avgValue)}</>}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={sourceFilter} onValueChange={setSourceFilter}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  <SelectItem value="land_registry">Land Registry</SelectItem>
                  <SelectItem value="rightmove">Rightmove</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" onClick={handleExportCSV} disabled={!filtered.length}>
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <MapPin className="h-10 w-10 text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-1">No comparable evidence</h3>
              <p className="text-muted-foreground text-sm mb-4">Add comparable sales or lettings to build your evidence base.</p>
              <Button size="sm" onClick={() => setShowAdd(true)}><Plus className="h-3.5 w-3.5 mr-1" /> Add Comparable</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Address</th>
                    <SortHeader field="sale_price" label="Price" current={sortField} asc={sortAsc} onSort={toggleSort} />
                    <SortHeader field="sale_date" label="Date" current={sortField} asc={sortAsc} onSort={toggleSort} />
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Type</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Beds</th>
                    <SortHeader field="price_per_sqm" label="£/sqm" current={sortField} asc={sortAsc} onSort={toggleSort} align="right" />
                    <SortHeader field="distance_miles" label="Dist (mi)" current={sortField} asc={sortAsc} onSort={toggleSort} align="right" />
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                    <th className="px-3 py-2 w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.property_type === 'flat' || c.property_type === 'F' ? (
                            <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          ) : (
                            <Home className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-medium truncate max-w-[200px]">{c.comp_address}</p>
                            {c.comp_postcode && <p className="text-xs text-muted-foreground">{c.comp_postcode}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-medium text-right">{fmtGBP(c.sale_price)}</td>
                      <td className="px-3 py-2.5 text-muted-foreground">{format(new Date(c.sale_date), 'dd/MM/yyyy')}</td>
                      <td className="px-3 py-2.5 text-muted-foreground capitalize">{c.property_type || '—'}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.beds ?? '—'}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.price_per_sqm ? fmtGBP(c.price_per_sqm) : '—'}</td>
                      <td className="px-3 py-2.5 text-right text-muted-foreground">{c.distance_miles?.toFixed(1) ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <Badge className={`text-xs ${SOURCE_COLOURS[c.source] ?? ''}`}>
                          {SOURCE_LABELS[c.source] ?? c.source}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteComp.mutate({ id: c.id, propertyId })}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Comparable Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Comparable</DialogTitle>
            <DialogDescription>
              Log a comparable sale to support the valuation evidence trail.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Address *</Label>
              <Input value={form.comp_address} onChange={(e) => setForm((f) => ({ ...f, comp_address: e.target.value }))} placeholder="123 Example Street" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Postcode</Label>
                <Input value={form.comp_postcode ?? ''} onChange={(e) => setForm((f) => ({ ...f, comp_postcode: e.target.value }))} placeholder="SW1A 1AA" />
              </div>
              <div className="grid gap-2">
                <Label>Sale Price *</Label>
                <Input type="number" value={form.sale_price || ''} onChange={(e) => setForm((f) => ({ ...f, sale_price: Number(e.target.value) }))} placeholder="250000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Sale Date *</Label>
                <Input type="date" value={form.sale_date} onChange={(e) => setForm((f) => ({ ...f, sale_date: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label>Property Type</Label>
                <Select value={form.property_type || ''} onValueChange={(v) => setForm((f) => ({ ...f, property_type: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="detached">Detached</SelectItem>
                    <SelectItem value="semi-detached">Semi-Detached</SelectItem>
                    <SelectItem value="terraced">Terraced</SelectItem>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Beds</Label>
                <Input type="number" value={form.beds ?? ''} onChange={(e) => setForm((f) => ({ ...f, beds: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="grid gap-2">
                <Label>Sqm</Label>
                <Input type="number" value={form.sqm ?? ''} onChange={(e) => setForm((f) => ({ ...f, sqm: e.target.value ? Number(e.target.value) : null }))} />
              </div>
              <div className="grid gap-2">
                <Label>Distance (mi)</Label>
                <Input type="number" step="0.1" value={form.distance_miles ?? ''} onChange={(e) => setForm((f) => ({ ...f, distance_miles: e.target.value ? Number(e.target.value) : null }))} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Source</Label>
              <Select value={form.source} onValueChange={(v) => setForm((f) => ({ ...f, source: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="land_registry">Land Registry</SelectItem>
                  <SelectItem value="rightmove">Rightmove</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Notes</Label>
              <Textarea value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} rows={2} placeholder="Additional context..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.comp_address || !form.sale_price || createComp.isPending}>
              {createComp.isPending ? 'Saving...' : 'Add Comparable'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SortHeader({
  field, label, current, asc, onSort, align = 'left',
}: {
  field: SortField; label: string; current: SortField; asc: boolean;
  onSort: (f: SortField) => void; align?: 'left' | 'right';
}) {
  return (
    <th
      className={`px-3 py-2 font-medium text-muted-foreground cursor-pointer select-none hover:text-foreground ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className={`h-3 w-3 ${current === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
        {current === field && <span className="text-[10px]">{asc ? '↑' : '↓'}</span>}
      </span>
    </th>
  );
}
