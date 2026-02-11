# Rent Collection — Bulk Actions

## Problem

With 29+ properties and multiple rooms each, the current Rent Collection page requires clicking into each individual rent item to mark it as paid, send a reminder, or take any action. On rent day this means 30-50 individual clicks to confirm standing orders have landed. There is no way to select multiple items and act on them at once.

---

## What To Build

Add a selection system to the Rent Collection page with a floating bulk action toolbar that appears when items are selected. Support 6 bulk actions: Mark Paid On Time, Mark Paid Late, Send Reminder, Write Off Bad Debt, Add Note, and Export Selected.

---

## Selection System

### Checkbox on every rent item

Add a checkbox to the left of each `RentScheduleRow` card (or table row if the aging table upgrade has been implemented). The checkbox should be visible at all times, not hidden behind hover.

### Select All / Deselect All

Add a "Select All" checkbox at the top of the list that:
- When checked: selects all **visible** items (respecting current filters)
- When unchecked: deselects all
- Shows indeterminate state when some but not all are selected

### Quick-select shortcuts

Add quick-select buttons next to the Select All checkbox:

| Button | Selects |
|--------|---------|
| **All Due** | All items with `status = 'due'` |
| **All Overdue** | All items with `status = 'overdue'` or `status = 'partial'` |
| **All Unpaid** | All items where `status` is NOT `'paid'` and NOT `'bad_debt'` |

These should be small text buttons, e.g. `Select all due (12)` showing the count.

### Selection state

```typescript
// Add to RentCollection.tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

const toggleSelection = (id: string) => {
  setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
};

const selectAll = () => {
  setSelectedIds(new Set(filteredSchedule.map(item => item.id)));
};

const deselectAll = () => {
  setSelectedIds(new Set());
};

const selectByStatus = (statuses: RentStatus[]) => {
  const ids = filteredSchedule
    .filter(item => statuses.includes(item.status))
    .map(item => item.id);
  setSelectedIds(new Set(ids));
};

// Derived state
const selectedItems = filteredSchedule.filter(item => selectedIds.has(item.id));
const selectedTotal = selectedItems.reduce((sum, item) => sum + item.amount_outstanding, 0);
const isAllSelected = filteredSchedule.length > 0 && selectedIds.size === filteredSchedule.length;
const isPartiallySelected = selectedIds.size > 0 && selectedIds.size < filteredSchedule.length;
```

### Clear selection when filters change

When the user changes month, status filter, property filter, or search — clear the selection to avoid acting on items that are no longer visible.

```typescript
useEffect(() => {
  setSelectedIds(new Set());
}, [monthStr, statusFilter, propertyFilter, search]);
```

---

## Floating Bulk Action Toolbar

When `selectedIds.size > 0`, show a fixed toolbar at the bottom of the viewport. This should slide up with animation and float above the page content.

### Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ✓ 14 selected  •  £38,220 outstanding       [actions...]  [✕ Clear] │
└─────────────────────────────────────────────────────────────────────┘
```

### Component: `BulkActionToolbar`

```typescript
// src/components/rent/BulkActionToolbar.tsx

interface BulkActionToolbarProps {
  selectedItems: RentScheduleWithDetails[];
  selectedTotal: number;
  onMarkPaidOnTime: () => void;
  onMarkPaidLate: () => void;
  onSendReminder: () => void;
  onWriteOffBadDebt: () => void;
  onAddNote: () => void;
  onExportSelected: () => void;
  onClearSelection: () => void;
  isProcessing: boolean;
}
```

### Styling

- Fixed position at bottom of viewport: `fixed bottom-0 left-0 right-0 z-50`
- Should account for sidebar width on desktop (use `left-[var(--sidebar-width)]` or similar)
- Dark background with white text: `bg-gray-900 text-white` (or `bg-card border-t` for themed approach)
- Rounded top corners, subtle shadow: `rounded-t-lg shadow-2xl`
- Slide-up animation when items are selected, slide-down when cleared
- Padding: `px-6 py-3`
- Max content width matching the page container

### Action buttons in toolbar

Each button should be compact with an icon:

| Button | Icon | Label | Available when |
|--------|------|-------|----------------|
| Mark Paid On Time | `CheckCircle2` | Paid on time | Any unpaid items selected |
| Mark Paid Late | `Clock` | Paid late | Any unpaid items selected |
| Send Reminder | `Send` | Send reminder | Any overdue/due items selected |
| Bad Debt | `Ban` | Write off | Any overdue items selected |
| Add Note | `MessageSquare` | Add note | Any items selected |
| Export | `Download` | Export | Any items selected |

Grey out / disable buttons that don't apply to the current selection. For example, if only `paid` items are selected, disable "Mark Paid On Time".

---

## Bulk Action 1: Mark Paid On Time

**Trigger:** Click "Paid on time" in bulk toolbar.

**Confirmation dialog:**

```
┌─────────────────────────────────────────────────┐
│  Mark 14 payments as paid on time?              │
│                                                  │
│  This will:                                      │
│  • Record a payment of £X for each item          │
│  • Set payment date to the due date              │
│  • Set payment method to Standing Order           │
│  • Mark each rent item as Paid                   │
│                                                  │
│  Total: £38,220.00                               │
│                                                  │
│  Payment method: [Standing Order ▼]              │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ ✓ 5 William Kimber - R1 J.Smith  £650   │   │
│  │ ✓ 5 William Kimber - R2 A.Jones  £625   │   │
│  │ ✓ 79 Waverley - R1 B.Brown      £730    │   │
│  │ ... 11 more                              │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│                    [Cancel]  [Confirm ✓]         │
└─────────────────────────────────────────────────┘
```

**Fields in dialog:**
- Payment method dropdown (default: "Standing Order") — applied to ALL items
- Scrollable list of selected items showing: property, room, tenant, amount
- Total amount displayed prominently

**What happens on confirm:**

For each selected item, execute two operations:

1. **Insert into `rent_payments`:**
```typescript
{
  org_id: orgId,
  tenancy_id: item.tenancy_id,
  rent_schedule_id: item.id,
  amount: item.amount_outstanding,
  payment_date: item.due_date, // <-- KEY: uses the DUE DATE, not today
  payment_method: selectedMethod, // from dropdown
  reference: null,
  notes: 'Bulk marked as paid on time',
  recorded_by: userId,
}
```

2. **Update `rent_schedule`:**
```typescript
{
  status: 'paid',
  amount_paid: item.rent_amount + item.additional_charges,
  amount_outstanding: 0,
}
```

### Hook: `useBulkMarkPaid`

```typescript
export function useBulkMarkPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      paymentMethod,
      paymentDate,  // 'due_date' for on-time, specific date for late
      notes,
    }: {
      items: RentScheduleWithDetails[];
      paymentMethod: string;
      paymentDate: 'due_date' | string; // 'due_date' = use each item's due date
      notes: string;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      const results = { success: 0, failed: 0, errors: [] as string[] };

      // Process items sequentially to avoid overwhelming the DB
      // (Could be parallelised with Promise.allSettled for speed)
      for (const item of items) {
        try {
          const actualPaymentDate = paymentDate === 'due_date' 
            ? item.due_date 
            : paymentDate;

          // 1. Insert payment record
          const { error: payError } = await supabase
            .from('rent_payments')
            .insert({
              org_id: orgId,
              tenancy_id: item.tenancy_id,
              rent_schedule_id: item.id,
              amount: item.amount_outstanding,
              payment_date: actualPaymentDate,
              payment_method: paymentMethod,
              reference: null,
              notes,
              recorded_by: user?.id || null,
            });

          if (payError) throw payError;

          // 2. Update schedule item
          const { error: schedError } = await supabase
            .from('rent_schedule')
            .update({
              status: 'paid',
              amount_paid: item.rent_amount + (item.additional_charges || 0),
              amount_outstanding: 0,
            })
            .eq('id', item.id);

          if (schedError) throw schedError;

          results.success++;
        } catch (err: any) {
          results.failed++;
          results.errors.push(
            `${item.tenancy.property.address_line} - ${item.tenancy.tenant.first_name}: ${err.message}`
          );
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });

      if (results.failed === 0) {
        toast({
          title: `${results.success} payments recorded`,
          description: 'All items marked as paid',
        });
      } else {
        toast({
          title: `${results.success} succeeded, ${results.failed} failed`,
          description: results.errors.slice(0, 3).join('\n'),
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Bulk payment failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
```

---

## Bulk Action 2: Mark Paid Late

Same as "Mark Paid On Time" except:
- Dialog title: "Mark 14 payments as paid late?"
- Shows an additional **Payment Date** field (date picker, defaults to today)
- The payment date entered is applied to ALL selected items
- Notes default: `'Bulk marked as paid late'`

Uses the same `useBulkMarkPaid` hook but passes the specific date string instead of `'due_date'`.

---

## Bulk Action 3: Send Reminder

**Trigger:** Click "Send reminder" in bulk toolbar.

**Confirmation dialog:**

```
┌─────────────────────────────────────────────────┐
│  Send reminder to 8 tenants?                    │
│                                                  │
│  Reminder type: [Overdue ▼]                      │
│                                                  │
│  Message preview:                                │
│  ┌──────────────────────────────────────────┐   │
│  │ Dear {tenant},                           │   │
│  │                                          │   │
│  │ Your rent payment of {amount} is now     │   │
│  │ {days} days overdue...                   │   │
│  └──────────────────────────────────────────┘   │
│  [Reset to template]                             │
│                                                  │
│  Recipients:                                     │
│  ┌──────────────────────────────────────────┐   │
│  │ ✓ J.Smith (j.smith@email.com)    £650   │   │
│  │ ✓ A.Jones (a.jones@email.com)    £625   │   │
│  │ ⚠ B.Brown (no email on file)    £730    │   │
│  │ ... 5 more                              │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ⚠ 2 tenants have no email — they will be       │
│    skipped                                       │
│                                                  │
│                    [Cancel]  [Send 6 reminders]  │
└─────────────────────────────────────────────────┘
```

**Key behaviors:**
- Show warning count for tenants with no email address
- Button label should show actual send count (excluding no-email tenants)
- Reminder type dropdown: Pre-Due / Due Date / Overdue
- Message template uses `{tenant}`, `{amount}`, `{days}` placeholders — personalised per recipient
- Custom message textarea (optional override)

**Hook: `useBulkSendReminder`**

```typescript
export function useBulkSendReminder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      reminderType,
      customMessage,
    }: {
      items: RentScheduleWithDetails[];
      reminderType: string;
      customMessage?: string;
    }) => {
      const results = { sent: 0, skipped: 0, failed: 0 };

      for (const item of items) {
        const email = (item.tenancy as any).tenant?.email;
        if (!email) {
          results.skipped++;
          continue;
        }

        try {
          const { error } = await supabase.functions.invoke('send-rent-reminder', {
            body: {
              rentScheduleId: item.id,
              tenancyId: item.tenancy_id,
              reminderType,
              customMessage,
            },
          });
          if (error) throw error;
          results.sent++;
        } catch {
          results.failed++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['payment_reminders'] });

      const parts = [];
      if (results.sent > 0) parts.push(`${results.sent} sent`);
      if (results.skipped > 0) parts.push(`${results.skipped} skipped (no email)`);
      if (results.failed > 0) parts.push(`${results.failed} failed`);

      toast({
        title: 'Reminders processed',
        description: parts.join(', '),
        variant: results.failed > 0 ? 'destructive' : 'default',
      });
    },
  });
}
```

**Note:** The existing `send-rent-reminder` edge function is called once per item. If this becomes a performance issue with many tenants, consider creating a `bulk-send-rent-reminders` edge function that accepts an array. For now, sequential calls are fine.

---

## Bulk Action 4: Write Off as Bad Debt

**Confirmation dialog:**

```
┌─────────────────────────────────────────────────┐
│  ⚠ Write off 3 payments as bad debt?            │
│                                                  │
│  This will mark £4,560 as unrecoverable.         │
│  This can be reversed on the individual payment  │
│  detail page.                                    │
│                                                  │
│  Reason (optional):                              │
│  [Tenant vacated, no forwarding address    ]     │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │ 79 Waverley - R3 C.Davis        £1,520  │   │
│  │ 11 Holmer - R1 D.Evans          £1,520  │   │
│  │ 11 Holmer - R1 D.Evans          £1,520  │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│              [Cancel]  [Write off £4,560]        │
└─────────────────────────────────────────────────┘
```

**Hook: `useBulkWriteOff`**

```typescript
export function useBulkWriteOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      reason,
    }: {
      items: RentScheduleWithDetails[];
      reason?: string;
    }) => {
      const ids = items.map(item => item.id);

      // Bulk update all at once
      const { error } = await supabase
        .from('rent_schedule')
        .update({
          status: 'bad_debt' as RentStatus,
          notes: reason
            ? `Bad debt write-off: ${reason}`
            : 'Bulk write-off as bad debt',
        })
        .in('id', ids);

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({
        title: `${result.count} items written off`,
        description: 'Marked as bad debt',
      });
    },
  });
}
```

---

## Bulk Action 5: Add Note

**Dialog:**

```
┌─────────────────────────────────────────────────┐
│  Add note to 14 items                            │
│                                                  │
│  Note:                                           │
│  ┌──────────────────────────────────────────┐   │
│  │ Chased by phone 10/02/2026              │   │
│  │                                          │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ○ Replace existing notes                        │
│  ● Append to existing notes                      │
│                                                  │
│                    [Cancel]  [Save note]         │
└─────────────────────────────────────────────────┘
```

**Behavior:**
- User types a note
- Chooses "Replace" or "Append" (default: Append)
- If Append: the new text is added after existing notes with a timestamp separator, e.g. `\n--- 10/02/2026 ---\nChased by phone`
- If Replace: overwrites entirely

**Hook: `useBulkAddNote`**

```typescript
export function useBulkAddNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      note,
      mode,
    }: {
      items: RentScheduleWithDetails[];
      note: string;
      mode: 'append' | 'replace';
    }) => {
      const today = new Date().toLocaleDateString('en-GB');
      let count = 0;

      for (const item of items) {
        let newNotes: string;
        if (mode === 'replace') {
          newNotes = note;
        } else {
          const separator = `\n--- ${today} ---\n`;
          newNotes = item.notes
            ? `${item.notes}${separator}${note}`
            : note;
        }

        const { error } = await supabase
          .from('rent_schedule')
          .update({ notes: newNotes })
          .eq('id', item.id);

        if (!error) count++;
      }

      return { count };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({
        title: `Note added to ${result.count} items`,
      });
    },
  });
}
```

---

## Bulk Action 6: Export Selected

No dialog needed. Immediately downloads a CSV of the selected items.

**Behavior:**
- Uses the existing `exportRentRollCSV` function from `src/lib/rentCsvExporter.ts`
- But passes only `selectedItems` instead of `filteredSchedule`
- Filename: `rent-selected-{date}.csv`

```typescript
const handleExportSelected = () => {
  exportRentRollCSV(selectedItems);
  deselectAll(); // optional: clear selection after export
};
```

---

## UI Integration into RentCollection.tsx

### Updated layout (changes in **bold**):

```
┌─────────────────────────────────────────────────────────┐
│  Rent Collection                [Export] [Export Arrears] │
├─────────────────────────────────────────────────────────┤
│  [Summary Cards]                                         │
├─────────────────────────────────────────────────────────┤
│  [Month Navigator]                                       │
├─────────────────────────────────────────────────────────┤
│  **☐ Select all  |  Select all due (12)  |**             │
│  **Select all overdue (5)  |  Select all unpaid (17)**   │
├─────────────────────────────────────────────────────────┤
│  [Filters]                                               │
├─────────────────────────────────────────────────────────┤
│  [Tabs: All | Needs Action | Paid]                       │
│                                                          │
│  **☐** [Status] Due: 01 Feb 2026                         │
│     J.Smith — Room 1 • 5 William Kimber Crescent         │
│                                            £650  [View]  │
│  **☑** [Status] Due: 01 Feb 2026                         │
│     A.Jones — Room 2 • 5 William Kimber Crescent         │
│                                            £625  [View]  │
│  ...                                                     │
│                                                          │
├─────────────────────────────────────────────────────────┤
│  **┌───────────────────────────────────────────────────┐**│
│  **│ ✓ 14 selected • £38,220    [Paid on time]        │**│
│  **│ [Paid late] [Send reminder] [Write off]          │**│
│  **│ [Add note] [Export]              [✕ Clear]       │**│
│  **└───────────────────────────────────────────────────┘**│
└─────────────────────────────────────────────────────────┘
```

### Checkbox placement

If using the current **card-based layout**: Add checkbox to the far left of each `RentScheduleRow`, vertically centered.

```tsx
// In RentScheduleRow, add at the start of the flex container:
<Checkbox
  checked={isSelected}
  onCheckedChange={() => onToggleSelection(item.id)}
  className="mt-1 shrink-0"
  aria-label={`Select ${item.tenancy.tenant.first_name} ${item.tenancy.tenant.last_name}`}
/>
```

If using the **table-based layout** (from the aging table upgrade): Add a checkbox column as the first column in the table header and each row.

### Updated RentScheduleRow props

```typescript
interface RentScheduleRowProps {
  item: RentScheduleWithDetails;
  isSelected: boolean;                    // NEW
  onToggleSelection: (id: string) => void; // NEW
  onRecordPayment: () => void;
  onView: () => void;
}
```

### Selected row visual indicator

When a row is selected, add a subtle highlight:
- Left border: `border-l-4 border-primary`
- Background: `bg-primary/5`

```tsx
<Card className={cn(
  item.status === 'overdue' ? 'border-destructive/30' : '',
  isSelected && 'border-l-4 border-l-primary bg-primary/5'
)}>
```

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/components/rent/BulkActionToolbar.tsx` | Floating bottom toolbar with action buttons |
| `src/components/rent/BulkMarkPaidDialog.tsx` | Confirmation dialog for Mark Paid (On Time + Late) |
| `src/components/rent/BulkSendReminderDialog.tsx` | Confirmation dialog for bulk reminders |
| `src/components/rent/BulkWriteOffDialog.tsx` | Confirmation dialog for bad debt write-off |
| `src/components/rent/BulkAddNoteDialog.tsx` | Dialog for adding notes to multiple items |

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/RentCollection.tsx` | Add selection state, checkbox in rows, quick-select buttons, render `BulkActionToolbar` |
| `src/hooks/useRentCollection.ts` | Add `useBulkMarkPaid`, `useBulkSendReminder`, `useBulkWriteOff`, `useBulkAddNote` hooks |
| `src/components/rent/PaymentFilters.tsx` | No changes needed |

---

## Confirmation Dialog Component Pattern

All bulk action dialogs should follow this consistent pattern:

```tsx
// src/components/rent/BulkMarkPaidDialog.tsx

interface BulkMarkPaidDialogProps {
  items: RentScheduleWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'on_time' | 'late';
  onSuccess: () => void; // called after successful bulk action to clear selection
}

export default function BulkMarkPaidDialog({
  items, open, onOpenChange, mode, onSuccess
}: BulkMarkPaidDialogProps) {
  const bulkMarkPaid = useBulkMarkPaid();
  const [paymentMethod, setPaymentMethod] = useState('standing_order');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const totalAmount = items.reduce((sum, item) => sum + item.amount_outstanding, 0);

  const handleConfirm = () => {
    bulkMarkPaid.mutate(
      {
        items,
        paymentMethod,
        paymentDate: mode === 'on_time' ? 'due_date' : paymentDate,
        notes: mode === 'on_time'
          ? 'Bulk marked as paid on time'
          : `Bulk marked as paid late (${paymentDate})`,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess(); // clears selection
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'on_time'
              ? `Mark ${items.length} payments as paid on time?`
              : `Mark ${items.length} payments as paid late?`}
          </DialogTitle>
          <DialogDescription>
            {mode === 'on_time'
              ? 'Each payment will be recorded on its due date.'
              : 'All payments will be recorded on the date you specify.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary */}
          <div className="rounded-md bg-muted p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Items</span>
              <span className="font-medium">{items.length}</span>
            </div>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted-foreground">Total amount</span>
              <span className="font-bold text-lg">
                £{totalAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label>Payment method (applied to all)</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standing_order">Standing Order</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="direct_debit">Direct Debit</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Payment date — only for 'late' mode */}
          {mode === 'late' && (
            <div className="space-y-2">
              <Label>Payment date (applied to all)</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
          )}

          {/* Scrollable item list */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              {items.length} items to be marked as paid:
            </Label>
            <div className="max-h-48 overflow-y-auto border rounded-md divide-y">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between items-center px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {item.tenancy.tenant.first_name} {item.tenancy.tenant.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.tenancy.room.room_name} • {item.tenancy.property.address_line}
                    </p>
                  </div>
                  <span className="font-medium shrink-0 ml-3">
                    £{item.amount_outstanding.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={bulkMarkPaid.isPending}>
            {bulkMarkPaid.isPending
              ? `Processing ${items.length} items…`
              : `Confirm ${items.length} payments`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## Progress Indicator for Large Batches

When processing more than 10 items, show a progress indicator inside the confirmation dialog:

```tsx
// Replace the simple "Processing..." text with:
{bulkMarkPaid.isPending && (
  <div className="space-y-2">
    <Progress value={(processedCount / items.length) * 100} />
    <p className="text-xs text-muted-foreground text-center">
      Processing {processedCount} of {items.length}...
    </p>
  </div>
)}
```

To support this, the mutation function should accept an `onProgress` callback:

```typescript
mutationFn: async ({ items, paymentMethod, paymentDate, notes, onProgress }) => {
  // ...
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    // ... process item ...
    onProgress?.(i + 1);
  }
  // ...
}
```

Use a ref to track progress without causing re-renders during processing:

```typescript
const processedRef = useRef(0);
const [processedCount, setProcessedCount] = useState(0);

// In mutate call:
onProgress: (count) => {
  processedRef.current = count;
  // Throttle state updates to avoid excessive re-renders
  if (count % 3 === 0 || count === items.length) {
    setProcessedCount(count);
  }
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+A` / `Cmd+A` | Select all visible items (when focus is in the rent list, not a text input) |
| `Escape` | Clear selection |

```typescript
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Don't trigger when typing in an input
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      selectAll();
    }
    if (e.key === 'Escape' && selectedIds.size > 0) {
      deselectAll();
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [filteredSchedule, selectedIds.size]);
```

---

## Implementation Order

1. **Add selection state** to `RentCollection.tsx` — `selectedIds` Set, toggle/selectAll/deselectAll functions
2. **Add checkboxes** to `RentScheduleRow` — pass `isSelected` and `onToggleSelection` props
3. **Add quick-select bar** — Select All checkbox + "Select all due/overdue/unpaid" buttons
4. **Create `BulkActionToolbar`** — floating bottom bar with action buttons
5. **Create `BulkMarkPaidDialog`** — supports both on-time and late modes
6. **Add `useBulkMarkPaid` hook** — sequential insert payments + update schedule
7. **Create `BulkSendReminderDialog`** — with no-email warning
8. **Add `useBulkSendReminder` hook** — sequential edge function calls
9. **Create `BulkWriteOffDialog`** — with reason field
10. **Add `useBulkWriteOff` hook** — single bulk update
11. **Create `BulkAddNoteDialog`** — with append/replace toggle
12. **Add `useBulkAddNote` hook** — sequential updates
13. **Wire up Export Selected** — reuse existing CSV exporter
14. **Add keyboard shortcuts** — Ctrl+A and Escape
15. **Add progress indicator** — for batches > 10 items
16. **Clear selection** on filter/month change
