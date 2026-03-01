# AF1: Mobile Responsive Audit & Fix

Systematic pass to make HydrogenCap usable on mobile devices (phones 375px+, tablets 768px+). Landlords are frequently on-site and need to check compliance, log maintenance, and view property details from their phone.

## Layout Shell

### Sidebar → Bottom Nav on Mobile

The current `AppSidebar` uses shadcn's Sidebar component which collapses on mobile. Enhance it:

In `AppLayout.tsx`, add a mobile bottom navigation bar (visible only on `md:hidden`):

```tsx
{/* Mobile bottom nav - shown below md breakpoint */}
<nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
  <div className="flex items-center justify-around h-14">
    <MobileNavItem icon={LayoutDashboard} label="Home" href="/dashboard" />
    <MobileNavItem icon={Building2} label="Properties" href="/properties-v2" />
    <MobileNavItem icon={Shield} label="Compliance" href="/compliance-v2" />
    <MobileNavItem icon={Wrench} label="Maintenance" href="/maintenance" />
    <MobileNavItem icon={Menu} label="More" onClick={toggleSidebar} />
  </div>
</nav>
```

The "More" button opens the full sidebar as an overlay/drawer.

Add `pb-16 md:pb-0` to the main content area to account for the bottom nav height.

### Header Bar

The header already has `h-14`. On mobile:
- Hide breadcrumbs (they take too much space)
- Show only: sidebar trigger (hamburger), page title (truncated), notification bell
- `<header className="flex h-14 items-center justify-between px-3 md:px-4">`

## Dashboard

### KPI Cards

Currently `grid md:grid-cols-5`. On mobile:
- Change to `grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4`
- KPI values: `text-xl md:text-3xl` (smaller on mobile)
- KPI labels: keep `text-xs`

### Dashboard Widgets

Currently `grid md:grid-cols-2 lg:grid-cols-4`. On mobile:
- Stack everything: `grid grid-cols-1 md:grid-cols-2 gap-4`
- Chart widgets: ensure Recharts `ResponsiveContainer` is used (it is — verify)
- Map widget: add `min-h-[250px] md:min-h-[400px]`

### Tabs

`TabsList` with 3+ tabs overflows on mobile. Add horizontal scroll:
```tsx
<TabsList className="w-full overflow-x-auto flex-nowrap">
```

## Properties List

### Card View on Mobile

The properties page likely uses a table or card grid. On mobile:
- Single column: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Property cards: stack info vertically, badges wrap
- Remove less critical info on mobile (entity type badge, listing grade)
- Keep: address, lifecycle badge, compliance dot, rent total

### Search & Filters

- Search input: `w-full md:w-auto md:min-w-[300px]`
- Filter selects: wrap to new line on mobile
- Consider a "Filters" button that opens a Sheet on mobile instead of inline dropdowns

## Tables (Global Fix)

Tables don't work on mobile. Apply across ALL table instances:

### Option A: Horizontal Scroll
```tsx
<div className="overflow-x-auto -mx-4 md:mx-0">
  <Table className="min-w-[600px]">
    ...
  </Table>
</div>
```

### Option B: Card View on Mobile
For key tables (maintenance requests, tenants, compliance matrix), switch to a card/list view on mobile:

```tsx
{/* Desktop: Table */}
<div className="hidden md:block">
  <Table>...</Table>
</div>

{/* Mobile: Card list */}
<div className="md:hidden space-y-3">
  {items.map(item => (
    <Card key={item.id} className="p-3">
      <div className="font-medium">{item.title}</div>
      <div className="text-sm text-muted-foreground">{item.subtitle}</div>
      <div className="flex gap-2 mt-2">
        <Badge>{item.status}</Badge>
        <Badge variant="outline">{item.priority}</Badge>
      </div>
    </Card>
  ))}
</div>
```

Apply this pattern to:
- Maintenance requests list
- Tenants list
- Compliance matrix (switch to a vertical list grouped by property)
- Lending facilities table
- Rent schedule

## Forms & Modals

### Dialog → Sheet on Mobile

For long forms (Property creation, maintenance request, compliance upload):

```tsx
// Use Sheet on mobile, Dialog on desktop
const isMobile = useMediaQuery('(max-width: 768px)');
const Wrapper = isMobile ? Sheet : Dialog;
```

Or use the shadcn `DrawerDialog` pattern if available.

### Form Layouts

- `grid grid-cols-2` fields → `grid grid-cols-1 md:grid-cols-2`
- Date pickers: ensure the calendar popup doesn't overflow the viewport
- Select dropdowns: verify they scroll properly in mobile viewports

### Sticky Form Actions

All form action buttons (Save/Cancel) should be:
```tsx
<div className="sticky bottom-0 bg-card border-t p-3 md:p-4 flex justify-end gap-2 -mx-4 md:mx-0 -mb-4 md:mb-0">
```

## Specific Component Fixes

### Compliance Matrix Grid

The matrix is a wide table (properties × document types). On mobile:
- Rotate to vertical: show one property at a time with its document statuses listed vertically
- Or add horizontal scroll with frozen first column (property name)

### Property Detail Page

Tabs with many tabs overflow. Use:
```tsx
<TabsList className="w-full overflow-x-auto whitespace-nowrap">
```

### Charts

All Recharts components should use `ResponsiveContainer` (verify they do). On mobile:
- Hide legends or move below chart
- Reduce label density on axes
- Pie charts: reduce size, move labels outside

## Touch Targets

Ensure all interactive elements meet 44×44px minimum tap target:
- Sidebar menu items: already `h-9` — increase to `h-10` on mobile
- Table row action buttons: ensure `min-h-[44px] min-w-[44px]`
- Badge-as-buttons: add padding

## Testing Approach

After implementation, test these key flows on a 375px viewport:
1. Login → Dashboard → view KPIs
2. Navigate to Properties → view a property → view rooms
3. Navigate to Compliance → view matrix → click a cell
4. Create a maintenance request (full form flow)
5. Navigate via bottom nav between all 5 sections

## Do NOT

- Do NOT redesign the desktop experience — only add mobile breakpoints
- Do NOT hide features on mobile — make them accessible, just laid out differently
- Do NOT add a separate mobile app — responsive web is sufficient
- Do NOT use `window.innerWidth` checks — use Tailwind breakpoints and CSS media queries only
