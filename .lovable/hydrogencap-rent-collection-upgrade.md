# Rent Collection Page — Arrears Aging & Detailed Ledger Upgrade

## Problem

The current Rent Collection page (`/rent`) only shows rent schedule items for the **selected month**. It does not show:
- Accumulated arrears from previous months
- An aging breakdown (30 / 60 / 90 / 90+ days overdue)
- Property-level grouping with totals
- A full rent ledger per tenancy showing running balance and payment history

This makes it impossible to see the true arrears position at a glance. A property manager needs to know: "Which properties owe me money, how much, and how long has it been outstanding?"

---

## What To Build

### Overview: Two-Level View

**Level 1 — Rent Roll Summary** (the main `/rent` page)
Shows all properties with arrears aging buckets, totals, and collection stats. This is the "at a glance" view.

**Level 2 — Tenancy Ledger** (click into a property or tenancy)
Shows the full chronological history of rent charges and payments for a specific tenancy, with running balance. This is the "detail" view.

---

## Level 1: Rent Roll Summary Page

### Top Summary Cards (4 cards, full width)

These should use bold, colored backgrounds like the reference screenshots — not the current plain white cards.

| Card | Color | Content |
|------|-------|---------|
| **Overdue** | Red/crimson background, white text | Total £ overdue across all properties (sum of all `rent_schedule` items where `status` is `overdue` or `partial` and `due_date < today`) |
| **Due Today** | Amber/yellow background, white text | Total £ due today (sum where `due_date = today` and `status` != `paid`) |
| **This Month** | Teal/green background, white text | Total £ expected this month (sum of `rent_amount + additional_charges` for current month). Show `£0` collected vs `£X` expected if partially collected. |
| **Next Month** | Dark teal background, white text | Total £ expected next month |

### Grouping Tabs (below summary cards)

Three toggle buttons in a row:

| Tab | Behavior |
|-----|----------|
| **Property** (default) | Group rent items by property address. Show one row per property with aging totals. |
| **Tenancy** | Group by tenancy (tenant + room). Show one row per tenancy. |
| **No Grouping** | Show every individual rent schedule item as a separate row (current behavior, but in table format). |

### Date Range & Filters (below grouping tabs)

Keep the existing filters but add:
- **Include all previous overdue rent** checkbox (default: ON) — when checked, the table includes ALL overdue items regardless of date, not just the selected month
- **Include only rent & additional charges** checkbox (default: ON) — excludes credits/adjustments

### Arrears Aging Table

This is the main table. When grouped by **Property**:

| Column | Description |
|--------|-------------|
| **Property** | Address line, with a link icon to navigate to `/properties/:id` |
| **30 Days** | Total £ outstanding where `due_date` is 1–30 days ago |
| **60 Days** | Total £ outstanding where `due_date` is 31–60 days ago |
| **90 Days** | Total £ outstanding where `due_date` is 61–90 days ago |
| **More** | Total £ outstanding where `due_date` is 90+ days ago |
| **Total** | Sum of all aging buckets for this property |

Each row should be **clickable** — clicking a property row expands it inline (accordion style) or navigates to a filtered view showing all tenancies at that property.

When grouped by **Tenancy**, add columns:
- Tenant Name
- Room
- Property

When **No Grouping**, show individual schedule items:
- Property, Room, Tenant, Due Date, Status badge, Amount, Paid, Outstanding, Actions

### New Data Hook: `useArrearsAging`

```typescript
// src/hooks/useRentCollection.ts — add this hook

export interface ArrearsAgingRow {
  // Grouping key
  property_id: string;
  property_address: string;
  property_postcode: string | null;
  
  // Aging buckets (£ outstanding)
  bucket_30: number;   // 1-30 days overdue
  bucket_60: number;   // 31-60 days overdue
  bucket_90: number;   // 61-90 days overdue
  bucket_more: number; // 90+ days overdue
  total: number;       // sum of all buckets
  
  // Breakdown by tenancy (for expansion)
  tenancies: {
    tenancy_id: string;
    tenant_name: string;
    room_name: string;
    bucket_30: number;
    bucket_60: number;
    bucket_90: number;
    bucket_more: number;
    total: number;
    schedule_items: RentScheduleWithDetails[]; // the individual overdue items
  }[];
}

export function useArrearsAging() {
  return useQuery({
    queryKey: ['rent_schedule', 'arrears_aging'],
    queryFn: async () => {
      // Fetch ALL overdue/partial rent schedule items (no month filter)
      const { data, error } = await supabase
        .from('rent_schedule')
        .select(`
          *,
          tenancy:tenancies(
            id,
            tenant:tenants(id, first_name, last_name, email, phone),
            room:rooms(room_name),
            property:properties(id, address_line, postcode)
          )
        `)
        .in('status', ['overdue', 'partial', 'due'])
        .lte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      // Client-side: bucket by property and aging period
      const today = new Date();
      const items = data as RentScheduleWithDetails[];
      
      // Group by property
      const propertyMap = new Map<string, ArrearsAgingRow>();
      
      for (const item of items) {
        const propId = item.tenancy.property.id;
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const amount = item.amount_outstanding;
        
        // Determine bucket
        let bucket: 'bucket_30' | 'bucket_60' | 'bucket_90' | 'bucket_more';
        if (daysOverdue <= 30) bucket = 'bucket_30';
        else if (daysOverdue <= 60) bucket = 'bucket_60';
        else if (daysOverdue <= 90) bucket = 'bucket_90';
        else bucket = 'bucket_more';
        
        // Initialize property row if needed
        if (!propertyMap.has(propId)) {
          propertyMap.set(propId, {
            property_id: propId,
            property_address: item.tenancy.property.address_line,
            property_postcode: item.tenancy.property.postcode,
            bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_more: 0, total: 0,
            tenancies: [],
          });
        }
        
        const row = propertyMap.get(propId)!;
        row[bucket] += amount;
        row.total += amount;
        
        // Also group within tenancies
        let tenancy = row.tenancies.find(t => t.tenancy_id === item.tenancy.id);
        if (!tenancy) {
          tenancy = {
            tenancy_id: item.tenancy.id,
            tenant_name: `${item.tenancy.tenant.first_name} ${item.tenancy.tenant.last_name}`,
            room_name: item.tenancy.room.room_name,
            bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_more: 0, total: 0,
            schedule_items: [],
          };
          row.tenancies.push(tenancy);
        }
        tenancy[bucket] += amount;
        tenancy.total += amount;
        tenancy.schedule_items.push(item);
      }
      
      // Sort by total descending (worst arrears first)
      return Array.from(propertyMap.values()).sort((a, b) => b.total - a.total);
    },
  });
}
```

### New Data Hook: `useMonthSummary`

For the top summary cards, we need a broader query:

```typescript
export function useMonthSummary() {
  return useQuery({
    queryKey: ['rent_schedule', 'month_summary'],
    queryFn: async () => {
      const today = new Date();
      const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);
      
      // All overdue items (any month, before today)
      const { data: overdue } = await supabase
        .from('rent_schedule')
        .select('amount_outstanding')
        .in('status', ['overdue', 'partial'])
        .lt('due_date', today.toISOString().split('T')[0]);
      
      // Due today
      const { data: dueToday } = await supabase
        .from('rent_schedule')
        .select('amount_outstanding, rent_amount, additional_charges')
        .eq('due_date', today.toISOString().split('T')[0])
        .neq('status', 'paid');
      
      // This month total expected & collected
      const { data: thisMonth } = await supabase
        .from('rent_schedule')
        .select('rent_amount, additional_charges, amount_paid, amount_outstanding, status')
        .gte('due_date', thisMonthStart)
        .lt('due_date', nextMonthStart);
      
      // Next month total expected
      const { data: nextMonthData } = await supabase
        .from('rent_schedule')
        .select('rent_amount, additional_charges')
        .gte('due_date', nextMonthStart)
        .lte('due_date', nextMonthEnd.toISOString().split('T')[0]);
      
      return {
        totalOverdue: overdue?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0,
        dueToday: dueToday?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0,
        thisMonthExpected: thisMonth?.reduce((s, r) => s + r.rent_amount + r.additional_charges, 0) || 0,
        thisMonthCollected: thisMonth?.reduce((s, r) => s + (r.amount_paid || 0), 0) || 0,
        nextMonthExpected: nextMonthData?.reduce((s, r) => s + r.rent_amount + r.additional_charges, 0) || 0,
      };
    },
  });
}
```

---

## Level 2: Tenancy Ledger Page

When the user clicks a property row (or a specific tenancy), navigate to a **Tenancy Ledger** view. This can either be:
- A new page at `/rent/tenancy/:tenancyId`  
- Or an expanded section within the property row on the main page

The reference screenshot (Image 2) shows the ideal layout.

### Ledger Header

At the top, show:
- Rent schedule info: "Rent is to be paid by **Bank transfer** on the **26th of each month** with the payment reference **TF32AR-RM1-SERCO**"
- Edit Schedule button

### Ledger Summary Cards (4 cards)

| Card | Color | Content |
|------|-------|---------|
| **Overdue** | Red | Total £ overdue for THIS tenancy |
| **Due [date]** | Amber | Next payment due amount and date |
| **Last Paid** | Teal | Last payment amount and date |
| **Paid on time %** | Green gradient | Percentage of rent items paid on time, with "X days late on average" subtitle |

### Ledger Table

A single chronological table showing ALL rent items AND payments interleaved, sorted by date descending (most recent first):

| Column | Description |
|--------|-------------|
| **Date** | Due date for rent items, payment date for payments |
| **Type** | "Rent (period start - period end)" for charges, "Payment" for payments |
| **Status** | Badge: Paid (green), Unconfirmed overdue (amber), blank for future |
| **Amount** | Positive for rent charges, negative (with minus sign) for payments |
| **Running Balance** | Cumulative balance. Should be £0.00 when all rent is paid up to date. Positive = tenant owes money. |
| **Actions** | "View" link to the existing `/rent/:scheduleId` detail page |

### Show future rent

Include a "Show all future" toggle at the top. When enabled, show projected rent items (status: upcoming) for the next 6 months.

### Ledger Filters (bottom of table)

Three toggles:
- Show deleted/reversed rent records (default: OFF)
- Show payments (default: ON)
- Show rent due items (default: ON)

### Ledger Action Buttons (bottom toolbar)

| Button | Action |
|--------|--------|
| **Log payment** | Open RecordPaymentDialog |
| **+ Rent credit** | Create a negative rent schedule item (credit/refund) |
| **+ Money due** | Create a one-off additional charge |
| **Mark all paid** | Mark all overdue items for this tenancy as paid |
| **Statement** | Generate a PDF rent statement for this tenancy |
| **Rent** | Edit the recurring rent amount |
| **Import CSV** | Import payment history from bank statement CSV |

### New Data Hook: `useTenancyLedger`

```typescript
export interface LedgerEntry {
  id: string;
  date: string;
  type: 'rent' | 'payment' | 'credit' | 'charge';
  description: string; // e.g. "Rent (26 Jan - 25 Feb)" or "Payment"
  status: RentStatus | 'payment' | null;
  amount: number; // positive for charges, negative for payments
  running_balance: number; // calculated client-side
  rent_schedule_id: string | null; // link to schedule item
  payment_id: string | null; // link to payment record
}

export function useTenancyLedger(tenancyId: string) {
  return useQuery({
    queryKey: ['tenancy_ledger', tenancyId],
    queryFn: async () => {
      // Get all rent schedule items for this tenancy
      const { data: scheduleItems, error: schedError } = await supabase
        .from('rent_schedule')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('due_date', { ascending: true });
      
      if (schedError) throw schedError;

      // Get all payments for this tenancy
      const { data: payments, error: payError } = await supabase
        .from('rent_payments')
        .select('*')
        .eq('tenancy_id', tenancyId)
        .order('payment_date', { ascending: true });
      
      if (payError) throw payError;

      // Build ledger entries
      const entries: LedgerEntry[] = [];
      
      // Add rent charges
      for (const item of scheduleItems || []) {
        entries.push({
          id: item.id,
          date: item.due_date,
          type: 'rent',
          description: `Rent (${format(new Date(item.period_start), 'dd MMM')} - ${format(new Date(item.period_end), 'dd MMM')})`,
          status: item.status,
          amount: item.rent_amount + item.additional_charges,
          running_balance: 0, // calculated below
          rent_schedule_id: item.id,
          payment_id: null,
        });
      }
      
      // Add payments (as negative amounts)
      for (const payment of payments || []) {
        entries.push({
          id: payment.id,
          date: payment.payment_date,
          type: 'payment',
          description: 'Payment',
          status: 'payment',
          amount: -payment.amount,
          running_balance: 0,
          rent_schedule_id: payment.rent_schedule_id,
          payment_id: payment.id,
        });
      }
      
      // Sort by date ascending, then charges before payments on same date
      entries.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        // On same date, charges first, then payments
        if (a.type === 'rent' && b.type === 'payment') return -1;
        if (a.type === 'payment' && b.type === 'rent') return 1;
        return 0;
      });
      
      // Calculate running balance
      let balance = 0;
      for (const entry of entries) {
        balance += entry.amount;
        entry.running_balance = balance;
      }
      
      // Return in reverse chronological order for display
      return entries.reverse();
    },
    enabled: !!tenancyId,
  });
}
```

### Paid On Time Calculation

```typescript
export function usePaidOnTimeStats(tenancyId: string) {
  return useQuery({
    queryKey: ['paid_on_time', tenancyId],
    queryFn: async () => {
      // Get all past rent items that should be paid
      const { data: items } = await supabase
        .from('rent_schedule')
        .select('due_date, status, updated_at')
        .eq('tenancy_id', tenancyId)
        .lte('due_date', new Date().toISOString().split('T')[0])
        .in('status', ['paid']);
      
      const { data: allPast } = await supabase
        .from('rent_schedule')
        .select('id')
        .eq('tenancy_id', tenancyId)
        .lte('due_date', new Date().toISOString().split('T')[0])
        .not('status', 'eq', 'upcoming');
      
      // Get payments matched to schedule items to calculate days late
      const { data: payments } = await supabase
        .from('rent_payments')
        .select('rent_schedule_id, payment_date')
        .eq('tenancy_id', tenancyId);
      
      if (!items || !allPast) return { percentOnTime: 0, avgDaysLate: 0, totalPast: 0 };
      
      const totalPast = allPast.length;
      const paidOnTime = items.length; // simplified — ideally check payment_date <= due_date
      
      // Calculate average days late from payments
      let totalDaysLate = 0;
      let lateCount = 0;
      
      // ... calculate from payment dates vs due dates
      
      return {
        percentOnTime: totalPast > 0 ? Math.round((paidOnTime / totalPast) * 100) : 0,
        avgDaysLate: lateCount > 0 ? Math.round(totalDaysLate / lateCount * 10) / 10 : 0,
        totalPast,
      };
    },
    enabled: !!tenancyId,
  });
}
```

---

## Updated Page Structure

### Route changes

```typescript
// In App.tsx, add new route:
<Route path="/rent/tenancy/:tenancyId" element={<ProtectedRoute><TenancyLedger /></ProtectedRoute>} />
```

### New files to create

| File | Purpose |
|------|---------|
| `src/pages/TenancyLedger.tsx` | Level 2 detail page |
| `src/components/rent/ArrearsAgingTable.tsx` | Aging table with expandable rows |
| `src/components/rent/RentSummaryCards.tsx` | Top 4 colored summary cards |
| `src/components/rent/GroupingTabs.tsx` | Property / Tenancy / No Grouping toggle |
| `src/components/rent/LedgerTable.tsx` | Chronological ledger with running balance |
| `src/components/rent/LedgerSummaryCards.tsx` | Per-tenancy summary cards (overdue, due, last paid, % on time) |

### Files to modify

| File | Change |
|------|--------|
| `src/pages/RentCollection.tsx` | Major rewrite — replace card-based layout with table-based aging view |
| `src/hooks/useRentCollection.ts` | Add `useArrearsAging`, `useMonthSummary`, `useTenancyLedger`, `usePaidOnTimeStats` hooks |
| `src/components/layout/AppSidebar.tsx` | No change needed (rent link already exists) |

---

## Detailed UI Spec: RentCollection.tsx Rewrite

### Layout (top to bottom):

```
┌─────────────────────────────────────────────────────────┐
│  Rent Collection              [Export Rent Roll] [Export Arrears] │
│  Track rent payments and arrears                         │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐│
│ │ £184,973 ││ │ £3,951   ││ │ £0 / £55,749 ││ │ £55,749 ││
│ │ Overdue  ││ │ Due today││ │ This month   ││ │Next month││
│ │ (RED)    ││ │ (AMBER)  ││ │ (TEAL)       ││ │(DK TEAL) ││
│ └──────────┘ └──────────┘ └──────────────┘ └──────────┘│
├─────────────────────────────────────────────────────────┤
│ [Property ✓]  [Tenancy]  [No Grouping]                  │
├─────────────────────────────────────────────────────────┤
│ Include rent records from:                               │
│ [Custom ▼ 10/02/2026]  [All tenancies ▼]               │
│ ☑ Include all previous overdue rent                      │
│ ☑ Include only rent & additional charges                 │
├─────────────────────────────────────────────────────────┤
│ Filter: [All properties ▼]  [Search...]                  │
├─────────────────────────────────────────────────────────┤
│ Property           │ 30 Days │ 60 Days │ 90 Days │ More │ Total    │
│────────────────────│─────────│─────────│─────────│──────│──────────│
│ 5 William Kimber ↗ │ £2,436  │ £0.00   │ £0.00   │£7,308│ £9,745   │
│ 79 Waverley ↗      │ £1,841  │ £1,841  │ £1,841  │£6,534│ £12,059  │
│ 11 Holmer Road ↗   │ £3,350  │ £3,350  │ £3,350  │£6,591│ £16,641  │
│ ...                │         │         │         │      │          │
├─────────────────────────────────────────────────────────┤
│                          [« ‹ 1 › »]  [All ▼]           │
└─────────────────────────────────────────────────────────┘
```

### Summary card styling

Use bold colored backgrounds matching the reference screenshot:
```css
/* Overdue card */
.summary-overdue { 
  background: #9B1B30; /* deep crimson */
  color: white;
}

/* Due today card */
.summary-due-today {
  background: #B8860B; /* dark goldenrod */  
  color: white;
}

/* This month card */
.summary-this-month {
  background: #5F7D8A; /* muted teal-gray */
  color: white;
}

/* Next month card */
.summary-next-month {
  background: #2C6E6A; /* deep teal */
  color: white;
}
```

Or use Tailwind equivalents. The key point is these should be **bold, filled backgrounds** — not the current white cards with small text.

### Table formatting

- Use `Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' })` for consistent £ formatting
- Right-align all monetary columns
- Show £0.00 explicitly (not blank) for zero amounts in aging buckets
- Property names should have a small external link icon (↗) that navigates to the property detail page
- Total column should be **bold**
- Add pagination (10/25/50/All per page)
- Bottom row: **Portfolio total** across all properties

### Row click behavior

Clicking a property row should expand it inline to show the tenancy breakdown:

```
│ 79 Waverley ↗       │ £1,841 │ £1,841 │ £1,841 │ £6,534│ £12,059 │
│   ├ Room 1 - J.Smith │ £920   │ £920   │ £920   │ £3,267│ £6,029  │  [View Ledger →]
│   └ Room 2 - A.Jones │ £920   │ £920   │ £920   │ £3,267│ £6,029  │  [View Ledger →]
```

Clicking "View Ledger →" navigates to `/rent/tenancy/:tenancyId`.

---

## Detailed UI Spec: TenancyLedger.tsx

### Layout:

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Rent Roll                                      │
│                                                          │
│ 79 Waverley — Room 1                                     │
│ John Smith                                               │
│                                                          │
│ Rent is to be paid by Bank transfer on the 26th of each  │
│ month with payment reference HYD-ABC12         [Edit Schedule] │
├─────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌───────────┐ ┌───────────────┐ ┌────────┐│
│ │ £10,920  ││ │ £2,730    ││ │ £2,730        ││ │63.64% ││
│ │ Overdue  ││ │ Due 26 Feb││ │ Paid 26 Sept  ││ │On time ││
│ │ (RED)    ││ │ (AMBER)   ││ │ (TEAL)        ││ │22.2d  ││
│ └──────────┘ └───────────┘ └───────────────┘ └────────┘│
├─────────────────────────────────────────────────────────┤
│ ☀ Show all future                                        │
├─────────────────────────────────────────────────────────┤
│ Date        │ Type                    │ Status      │ Amount   │ Running Balance │ Actions │
│─────────────│─────────────────────────│─────────────│──────────│─────────────────│─────────│
│ 26 Jul 2026 │ Rent (26 Jul - 25 Aug)  │             │ £2,730   │                 │ View    │
│ 26 Jun 2026 │ Rent (26 Jun - 25 Jul)  │             │ £2,730   │                 │ View    │
│ ...future items...                                                                         │
│ 26 Jan 2026 │ Rent (26 Jan - 25 Feb)  │ Unconf. o/d │ £2,730   │ -£10,920        │ View    │
│ 26 Dec 2025 │ Rent (26 Dec - 25 Jan)  │ Unconf. o/d │ £2,730   │ -£8,190         │ View    │
│ 26 Nov 2025 │ Rent (26 Nov - 25 Dec)  │ Unconf. o/d │ £2,730   │ -£5,460         │ View    │
│ 26 Oct 2025 │ Rent (26 Oct - 25 Nov)  │ Unconf. o/d │ £2,730   │ -£2,730         │ View    │
│ 26 Sept 2025│ Payment                 │             │ -£2,730  │ £0.00           │ View    │
│ 26 Sept 2025│ Rent (26 Sept - 25 Oct) │ Paid ✓      │ £2,730   │ -£2,730         │ View    │
│ 26 Aug 2025 │ Payment                 │             │ -£2,730  │ £0.00           │ View    │
│ 26 Aug 2025 │ Rent (26 Aug - 25 Sept) │ Paid ✓      │ £2,730   │ -£2,730         │ View    │
│ ...                                                                                        │
├─────────────────────────────────────────────────────────┤
│ ○ Show deleted/reversed    ● Show payments    ● Show rent due │
├─────────────────────────────────────────────────────────┤
│ [Log payment] [+ Rent credit] [+ Money due] [✓ Mark all paid] │
│ [Statement] [Rent] [Import CSV]                          │
└─────────────────────────────────────────────────────────┘
```

### Running Balance Column

The running balance should be calculated **bottom-up** (oldest first):
- Start at £0
- Each rent charge ADDS to the balance (tenant owes more)
- Each payment SUBTRACTS from the balance (tenant paid)
- Display shows the balance AFTER that transaction
- Negative running balance = tenant is in credit (has overpaid)
- Positive running balance = tenant owes money
- When balance is £0.00, display in normal text
- When balance is negative (tenant owes), display in **red bold**
- Future items don't show a running balance (leave blank)

### Status Badges

| Status | Badge Style |
|--------|-------------|
| Paid | Green background, white text, "Paid" |
| Unconfirmed overdue | Amber/orange border, "Unconfirmed overdue" |
| Overdue | Red background, "Overdue" |
| Partial | Amber background, "Partial £X" |
| (payment row) | No badge needed |
| (future) | No badge |

### Payment Row Styling

Payment rows should be styled differently from rent rows:
- Amount shown in **green** with minus sign (e.g. `-£2,730.00`)
- Running balance shows result after payment
- Date shown in green text

---

## Database Changes

No schema changes are required. All data already exists in `rent_schedule` and `rent_payments` tables. The aging calculation is done client-side.

However, consider adding these indexes for performance if they don't exist:

```sql
CREATE INDEX IF NOT EXISTS idx_rent_schedule_status_due 
ON rent_schedule(status, due_date);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_tenancy_due 
ON rent_schedule(tenancy_id, due_date);

CREATE INDEX IF NOT EXISTS idx_rent_payments_tenancy_date 
ON rent_payments(tenancy_id, payment_date);
```

---

## Implementation Order

1. **Create `useArrearsAging` and `useMonthSummary` hooks** in `useRentCollection.ts`
2. **Create `RentSummaryCards` component** — 4 bold colored summary cards
3. **Create `ArrearsAgingTable` component** — table with expandable property rows
4. **Rewrite `RentCollection.tsx`** — replace current card layout with new summary + aging table
5. **Create `useTenancyLedger` hook** — fetch all schedule items + payments, build ledger
6. **Create `LedgerTable` component** — chronological table with running balance
7. **Create `TenancyLedger.tsx` page** — header, summary cards, ledger table, action toolbar
8. **Add route** for `/rent/tenancy/:tenancyId`
9. **Keep existing `/rent/:scheduleId`** (PaymentDetail page) — this is the individual item detail, still useful

### What to keep from current page
- `RecordPaymentDialog` — reuse as-is
- `SendReminderDialog` — reuse as-is
- `PaymentFilters` — adapt for new filter needs
- `rentCsvExporter` — update `exportArrearsCSV` to include aging buckets
- All existing hooks (`useRecordPayment`, `useUpdateRentScheduleStatus`, etc.)

### What to remove
- `RentScheduleRow` component (the card-based row) — replaced by table rows
- Month navigator arrows — replaced by date range picker and "include all overdue" checkbox
