import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ArrearsAgingRow, RentScheduleWithDetails } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface ArrearsAgingTableProps {
  data: ArrearsAgingRow[];
  grouping: 'property' | 'tenancy' | 'none';
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
  onToggleAll?: () => void;
  isAllSelected?: boolean;
  isPartiallySelected?: boolean;
}

function PropertyRow({
  row,
  selectedIds,
  onToggleSelection,
}: {
  row: ArrearsAgingRow;
  selectedIds?: Set<string>;
  onToggleSelection?: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  // Check if all schedule items in this property are selected
  const allItemIds = row.tenancies.flatMap(t => t.schedule_items.map(s => s.id));
  const selectedCount = allItemIds.filter(id => selectedIds?.has(id)).length;
  const isAllPropertySelected = allItemIds.length > 0 && selectedCount === allItemIds.length;
  const isPartialPropertySelected = selectedCount > 0 && selectedCount < allItemIds.length;

  const togglePropertySelection = () => {
    if (!onToggleSelection) return;
    if (isAllPropertySelected) {
      // Deselect all
      allItemIds.forEach(id => {
        if (selectedIds?.has(id)) onToggleSelection(id);
      });
    } else {
      // Select all
      allItemIds.forEach(id => {
        if (!selectedIds?.has(id)) onToggleSelection(id);
      });
    }
  };

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {onToggleSelection && (
          <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={isAllPropertySelected ? true : isPartialPropertySelected ? 'indeterminate' : false}
              onCheckedChange={togglePropertySelection}
              aria-label={`Select all items for ${row.property_address}`}
            />
          </TableCell>
        )}
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span>{row.property_address}</span>
            <Link
              to={`/properties/${row.property_id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-muted-foreground hover:text-primary"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums">{fmt(row.bucket_30)}</TableCell>
        <TableCell className="text-right tabular-nums">{fmt(row.bucket_60)}</TableCell>
        <TableCell className="text-right tabular-nums">{fmt(row.bucket_90)}</TableCell>
        <TableCell className="text-right tabular-nums">{fmt(row.bucket_more)}</TableCell>
        <TableCell className="text-right font-bold tabular-nums">{fmt(row.total)}</TableCell>
      </TableRow>

      {expanded && row.tenancies.map((t) => (
        <TableRow key={t.tenancy_id} className="bg-muted/30">
          {onToggleSelection && <TableCell className="w-10" />}
          <TableCell className="pl-10">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">├</span>
              <span>{t.room_name === 'Whole Property' ? t.tenant_name : `${t.room_name} — ${t.tenant_name}`}</span>
              <Link
                to={`/rent/tenancy/${t.tenancy_id}`}
                className="text-xs text-primary hover:underline ml-auto"
              >
                View Ledger →
              </Link>
            </div>
          </TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(t.bucket_30)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(t.bucket_60)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(t.bucket_90)}</TableCell>
          <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(t.bucket_more)}</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{fmt(t.total)}</TableCell>
        </TableRow>
      ))}
    </>
  );
}

export function ArrearsAgingTable({
  data,
  grouping,
  selectedIds,
  onToggleSelection,
  onToggleAll,
  isAllSelected,
  isPartiallySelected,
}: ArrearsAgingTableProps) {
  const portfolioTotal = data.reduce(
    (acc, r) => ({
      bucket_30: acc.bucket_30 + r.bucket_30,
      bucket_60: acc.bucket_60 + r.bucket_60,
      bucket_90: acc.bucket_90 + r.bucket_90,
      bucket_more: acc.bucket_more + r.bucket_more,
      total: acc.total + r.total,
    }),
    { bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_more: 0, total: 0 }
  );

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No outstanding arrears — all rent is up to date! 🎉
        </CardContent>
      </Card>
    );
  }

  const showCheckboxes = !!onToggleSelection;

  if (grouping === 'tenancy') {
    const allTenancies = data.flatMap((r) =>
      r.tenancies.map((t) => ({ ...t, property_address: r.property_address, property_id: r.property_id }))
    ).sort((a, b) => b.total - a.total);

    return (
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {showCheckboxes && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Tenant</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Property</TableHead>
              <TableHead className="text-right">30 Days</TableHead>
              <TableHead className="text-right">60 Days</TableHead>
              <TableHead className="text-right">90 Days</TableHead>
              <TableHead className="text-right">90+</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allTenancies.map((t) => {
              const tenancyItemIds = t.schedule_items.map(s => s.id);
              const tenancySelectedCount = tenancyItemIds.filter(id => selectedIds?.has(id)).length;
              const isAllTenancySelected = tenancyItemIds.length > 0 && tenancySelectedCount === tenancyItemIds.length;
              const isPartialTenancy = tenancySelectedCount > 0 && tenancySelectedCount < tenancyItemIds.length;

              const toggleTenancySelection = () => {
                if (!onToggleSelection) return;
                if (isAllTenancySelected) {
                  tenancyItemIds.forEach(id => { if (selectedIds?.has(id)) onToggleSelection(id); });
                } else {
                  tenancyItemIds.forEach(id => { if (!selectedIds?.has(id)) onToggleSelection(id); });
                }
              };

              return (
                <TableRow
                  key={t.tenancy_id}
                  className={cn(
                    isAllTenancySelected && 'bg-primary/5'
                  )}
                >
                  {showCheckboxes && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={isAllTenancySelected ? true : isPartialTenancy ? 'indeterminate' : false}
                        onCheckedChange={toggleTenancySelection}
                        aria-label={`Select ${t.tenant_name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{t.tenant_name}</TableCell>
                  <TableCell>{t.room_name}</TableCell>
                  <TableCell className="text-muted-foreground">{t.property_address}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(t.bucket_30)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(t.bucket_60)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(t.bucket_90)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(t.bucket_more)}</TableCell>
                  <TableCell className="text-right font-bold tabular-nums">{fmt(t.total)}</TableCell>
                  <TableCell>
                    <Link to={`/rent/tenancy/${t.tenancy_id}`} className="text-xs text-primary hover:underline">
                      Ledger →
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={showCheckboxes ? 4 : 3} className="font-bold">Portfolio Total</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_30)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_60)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_90)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_more)}</TableCell>
              <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.total)}</TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
    );
  }

  if (grouping === 'none') {
    const allItems = data.flatMap((r) =>
      r.tenancies.flatMap((t) =>
        t.schedule_items.map((item) => ({
          ...item,
          tenant_name: t.tenant_name,
          room_name: t.room_name,
        }))
      )
    ).sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    return (
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {showCheckboxes && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                    onCheckedChange={onToggleAll}
                    aria-label="Select all"
                  />
                </TableHead>
              )}
              <TableHead>Property</TableHead>
              <TableHead>Room</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Outstanding</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allItems.map((item) => {
              const isSelected = selectedIds?.has(item.id) ?? false;
              return (
                <TableRow
                  key={item.id}
                  className={cn(isSelected && 'bg-primary/5')}
                >
                  {showCheckboxes && (
                    <TableCell className="w-10">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelection?.(item.id)}
                        aria-label={`Select ${item.tenant_name}`}
                      />
                    </TableCell>
                  )}
                  <TableCell className="text-muted-foreground">{item.tenancy.property.address_line}</TableCell>
                  <TableCell>{item.room_name}</TableCell>
                  <TableCell className="font-medium">{item.tenant_name}</TableCell>
                  <TableCell>{new Date(item.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(item.rent_amount + item.additional_charges)}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">{fmt(item.amount_paid)}</TableCell>
                  <TableCell className="text-right tabular-nums font-bold text-destructive">{fmt(item.amount_outstanding)}</TableCell>
                  <TableCell>
                    <Link to={`/rent/${item.id}`} className="text-xs text-primary hover:underline">
                      View
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    );
  }

  // Default: property grouping
  return (
    <Card className="overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {showCheckboxes && (
              <TableHead className="w-10">
                <Checkbox
                  checked={isAllSelected ? true : isPartiallySelected ? 'indeterminate' : false}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all"
                />
              </TableHead>
            )}
            <TableHead>Property</TableHead>
            <TableHead className="text-right">30 Days</TableHead>
            <TableHead className="text-right">60 Days</TableHead>
            <TableHead className="text-right">90 Days</TableHead>
            <TableHead className="text-right">90+</TableHead>
            <TableHead className="text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <PropertyRow
              key={row.property_id}
              row={row}
              selectedIds={selectedIds}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell colSpan={showCheckboxes ? 2 : 1} className="font-bold">Portfolio Total</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_30)}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_60)}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_90)}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.bucket_more)}</TableCell>
            <TableCell className="text-right font-bold tabular-nums">{fmt(portfolioTotal.total)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </Card>
  );
}
