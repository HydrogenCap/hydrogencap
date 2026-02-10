import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { ArrearsAgingRow } from '@/hooks/useRentCollection';

const fmt = (v: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(v);

interface ArrearsAgingTableProps {
  data: ArrearsAgingRow[];
  grouping: 'property' | 'tenancy' | 'none';
}

function PropertyRow({ row }: { row: ArrearsAgingRow }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
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
          <TableCell className="pl-10">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">├</span>
              <span>{t.room_name} — {t.tenant_name}</span>
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

export function ArrearsAgingTable({ data, grouping }: ArrearsAgingTableProps) {
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

  if (grouping === 'tenancy') {
    const allTenancies = data.flatMap((r) =>
      r.tenancies.map((t) => ({ ...t, property_address: r.property_address, property_id: r.property_id }))
    ).sort((a, b) => b.total - a.total);

    return (
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
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
            {allTenancies.map((t) => (
              <TableRow key={t.tenancy_id}>
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
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={3} className="font-bold">Portfolio Total</TableCell>
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
            {allItems.map((item) => (
              <TableRow key={item.id}>
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
            ))}
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
            <PropertyRow key={row.property_id} row={row} />
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="font-bold">Portfolio Total</TableCell>
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
