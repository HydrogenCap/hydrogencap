# HydrogenCap — NEXT Phase 2.3: Maintenance & Works Orders

## Context

HydrogenCap now has property management, tenant lifecycle, compliance workflows, and rent collection. The missing operational backbone is maintenance. At 50 HMOs with 300 tenants, you will receive 200-400 maintenance requests per year — boiler breakdowns, leaking taps, broken windows, damp complaints, appliance failures, pest control, lock changes, and everything in between.

Without a system, maintenance lives in WhatsApp messages, text chains, and the operator's memory. Jobs get forgotten. Contractors get double-booked. Spend is invisible. Recurring problems at specific properties go undetected. Tenants get frustrated and leave, creating voids that cost more than the repair would have.

This module covers: issue reporting, works order management, contractor assignment, quote tracking, job completion, spend analytics, and recurring issue detection.

## Database Tables

### `maintenance_requests`

The initial report of an issue — what the tenant or operator sees:

```sql
create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  room_id uuid references public.rooms(id),
  tenant_id uuid references public.tenants(id),
  reported_by text not null default 'operator' check (reported_by in ('tenant', 'operator', 'contractor', 'inspector', 'agent')),
  category text not null check (category in (
    'plumbing',
    'electrical',
    'heating',
    'structural',
    'damp_mould',
    'pest_control',
    'appliance',
    'locks_security',
    'windows_doors',
    'flooring',
    'painting_decorating',
    'garden_external',
    'cleaning',
    'fire_safety',
    'furniture',
    'communal_areas',
    'roof_guttering',
    'drainage',
    'other'
  )),
  priority text not null default 'medium' check (priority in ('emergency', 'urgent', 'medium', 'low')),
  title text not null,
  description text,
  location_detail text,
  photo_urls text[],
  reported_date date not null default current_date,
  status text not null default 'reported' check (status in (
    'reported',
    'triaged',
    'quoted',
    'approved',
    'scheduled',
    'in_progress',
    'completed',
    'verified',
    'closed',
    'cancelled',
    'on_hold'
  )),
  is_emergency boolean default false,
  is_recurring boolean default false,
  linked_request_id uuid references public.maintenance_requests(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_maintenance_requests_property on public.maintenance_requests(property_id);
create index idx_maintenance_requests_room on public.maintenance_requests(room_id);
create index idx_maintenance_requests_tenant on public.maintenance_requests(tenant_id);
create index idx_maintenance_requests_status on public.maintenance_requests(status);
create index idx_maintenance_requests_priority on public.maintenance_requests(priority);
create index idx_maintenance_requests_category on public.maintenance_requests(category);
create index idx_maintenance_requests_reported_date on public.maintenance_requests(reported_date);
```

### `works_orders`

The operational response to a maintenance request — contractor assignment, scheduling, costs:

```sql
create table public.works_orders (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete restrict,
  property_id uuid not null references public.properties(id) on delete restrict,
  contractor_id uuid references public.compliance_contractors(id),
  contractor_name_override text,
  contractor_phone_override text,
  contractor_email_override text,
  order_number text,
  description text not null,
  status text not null default 'draft' check (status in (
    'draft',
    'sent_to_contractor',
    'quote_received',
    'approved',
    'scheduled',
    'in_progress',
    'completed',
    'invoiced',
    'paid',
    'cancelled',
    'disputed'
  )),
  quoted_amount numeric(10,2),
  approved_amount numeric(10,2),
  invoice_amount numeric(10,2),
  paid_amount numeric(10,2),
  quote_date date,
  approval_date date,
  scheduled_date date,
  scheduled_time_slot text check (scheduled_time_slot in ('morning', 'afternoon', 'all_day', 'specific')),
  scheduled_time text,
  completion_date date,
  invoice_reference text,
  invoice_date date,
  paid_date date,
  payment_method text check (payment_method in ('bank_transfer', 'card', 'cash', 'cheque', 'account')),
  tenant_access_required boolean default true,
  tenant_notified boolean default false,
  tenant_notification_date date,
  warranty_months integer,
  warranty_expiry date,
  completion_notes text,
  completion_photo_urls text[],
  before_photo_urls text[],
  after_photo_urls text[],
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_works_orders_request on public.works_orders(maintenance_request_id);
create index idx_works_orders_property on public.works_orders(property_id);
create index idx_works_orders_contractor on public.works_orders(contractor_id);
create index idx_works_orders_status on public.works_orders(status);
create index idx_works_orders_scheduled on public.works_orders(scheduled_date);
```

### `maintenance_comments`

Timeline of updates on a maintenance request — operator notes, tenant responses, contractor updates:

```sql
create table public.maintenance_comments (
  id uuid primary key default gen_random_uuid(),
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  author_type text not null check (author_type in ('operator', 'tenant', 'contractor', 'system')),
  author_name text not null,
  comment text not null,
  photo_urls text[],
  is_internal boolean default false,
  created_at timestamptz default now()
);

create index idx_maintenance_comments_request on public.maintenance_comments(maintenance_request_id);
```

### RLS Policies

```sql
alter table public.maintenance_requests enable row level security;
alter table public.works_orders enable row level security;
alter table public.maintenance_comments enable row level security;

create policy "Authenticated access" on public.maintenance_requests for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.works_orders for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.maintenance_comments for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Audit Triggers

```sql
create trigger audit_maintenance_requests after insert or update or delete on public.maintenance_requests for each row execute function public.audit_trigger_function();
create trigger audit_works_orders after insert or update or delete on public.works_orders for each row execute function public.audit_trigger_function();
```

### Extend Compliance Contractors Table

The compliance_contractors table (created in 1.6) already stores contractor details. Extend it to support maintenance contractors by ensuring the `service_types` array can include maintenance categories. No schema change needed — just ensure the UI allows adding maintenance categories when creating or editing contractors. The same plumber who does your legionella risk assessment might also fix your leaking taps.

### Maintenance Summary Views

```sql
create or replace view public.maintenance_overview as
select
  mr.id as request_id,
  mr.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  le.entity_name,
  mr.room_id,
  r.room_name,
  mr.tenant_id,
  t.first_name || ' ' || t.last_name as tenant_name,
  mr.category,
  mr.priority,
  mr.title,
  mr.status,
  mr.is_emergency,
  mr.is_recurring,
  mr.reported_date,
  mr.reported_by,
  current_date - mr.reported_date as days_open,
  wo.id as works_order_id,
  wo.contractor_id,
  coalesce(cc.company_name, wo.contractor_name_override) as contractor_name,
  wo.status as works_order_status,
  wo.quoted_amount,
  wo.approved_amount,
  wo.invoice_amount,
  wo.scheduled_date,
  wo.completion_date,
  (select count(*) from public.maintenance_comments mc where mc.maintenance_request_id = mr.id) as comment_count
from public.maintenance_requests mr
join public.properties p on p.id = mr.property_id
join public.legal_entities le on le.id = p.entity_id
left join public.rooms r on r.id = mr.room_id
left join public.tenants t on t.id = mr.tenant_id
left join public.works_orders wo on wo.maintenance_request_id = mr.id
  and wo.status not in ('cancelled')
left join public.compliance_contractors cc on cc.id = wo.contractor_id
order by
  case mr.priority when 'emergency' then 0 when 'urgent' then 1 when 'medium' then 2 when 'low' then 3 end,
  mr.reported_date asc;
```

```sql
create or replace view public.maintenance_spend_by_property as
select
  wo.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  le.entity_name,
  count(wo.id) as total_jobs,
  count(wo.id) filter (where wo.status = 'completed' or wo.status = 'paid') as completed_jobs,
  coalesce(sum(wo.invoice_amount) filter (where wo.status in ('invoiced', 'paid')), 0) as total_invoiced,
  coalesce(sum(wo.paid_amount) filter (where wo.status = 'paid'), 0) as total_paid,
  coalesce(avg(wo.invoice_amount) filter (where wo.invoice_amount > 0), 0) as avg_job_cost,
  coalesce(avg(wo.completion_date - mr.reported_date) filter (where wo.completion_date is not null), 0) as avg_days_to_complete
from public.works_orders wo
join public.maintenance_requests mr on mr.id = wo.maintenance_request_id
join public.properties p on p.id = wo.property_id
join public.legal_entities le on le.id = p.entity_id
where wo.status not in ('cancelled', 'draft')
group by wo.property_id, p.address_line_1, p.postcode, le.entity_name
order by total_paid desc;
```

```sql
create or replace view public.maintenance_spend_by_category as
select
  mr.category,
  count(wo.id) as job_count,
  coalesce(sum(wo.invoice_amount) filter (where wo.status in ('invoiced', 'paid')), 0) as total_spend,
  coalesce(avg(wo.invoice_amount) filter (where wo.invoice_amount > 0), 0) as avg_cost,
  coalesce(avg(wo.completion_date - mr.reported_date) filter (where wo.completion_date is not null), 0) as avg_resolution_days
from public.maintenance_requests mr
left join public.works_orders wo on wo.maintenance_request_id = mr.id and wo.status not in ('cancelled', 'draft')
group by mr.category
order by total_spend desc;
```

```sql
create or replace view public.contractor_performance as
select
  cc.id as contractor_id,
  cc.company_name,
  cc.service_types,
  cc.rating,
  count(wo.id) as total_jobs,
  count(wo.id) filter (where wo.status in ('completed', 'paid')) as completed_jobs,
  coalesce(sum(wo.paid_amount), 0) as total_paid,
  coalesce(avg(wo.invoice_amount) filter (where wo.invoice_amount > 0), 0) as avg_job_cost,
  coalesce(avg(wo.completion_date - wo.scheduled_date) filter (where wo.completion_date is not null and wo.scheduled_date is not null), 0) as avg_days_over_schedule,
  coalesce(avg(wo.completion_date - mr.reported_date) filter (where wo.completion_date is not null), 0) as avg_report_to_completion_days,
  count(wo.id) filter (where wo.status = 'disputed') as disputed_jobs
from public.compliance_contractors cc
left join public.works_orders wo on wo.contractor_id = cc.id
left join public.maintenance_requests mr on mr.id = wo.maintenance_request_id
group by cc.id, cc.company_name, cc.service_types, cc.rating
order by completed_jobs desc;
```

---

## UI — Maintenance Page

Create a **Maintenance** page accessible from the sidebar (icon: 🔧, label: "Maintenance"). Position after Rent Collection.

### Maintenance Summary Stats Bar

5 stat cards:

1. **Open Requests** — count where status not in ('completed', 'verified', 'closed', 'cancelled'). Amber if > 10, red if > 20.
2. **Emergencies** — count where is_emergency = true and status not in ('completed', 'verified', 'closed', 'cancelled'). Red background if > 0.
3. **Avg Resolution Time** — average days_open for requests closed in the last 90 days. Green if <7 days, amber 7-14, red >14.
4. **Monthly Spend** — sum of invoice_amount from works_orders completed in current month. Format as £X,XXX.
5. **Awaiting Approval** — count of works_orders where status = 'quote_received'. Amber if > 0 — these need operator action.

### Maintenance Request List

Default view is a **table** (not kanban — maintenance has too many statuses for a useful board. Table with good filtering is more practical here).

**Columns:**
- **Priority** — icon indicator: emergency = red siren icon, urgent = red circle, medium = amber circle, low = blue circle
- **Title** (clickable to detail view)
- **Category** — badge with category-appropriate colour:
  - plumbing = blue
  - electrical = amber
  - heating = orange
  - structural = red
  - damp_mould = teal
  - pest_control = green
  - appliance = purple
  - locks_security = indigo
  - fire_safety = red
  - All others = slate
- **Property** (address, clickable)
- **Room** (room name or "Communal" / "External")
- **Tenant** (name or "—")
- **Status** — coloured badge:
  - reported = "Reported" blue
  - triaged = "Triaged" sky blue
  - quoted = "Quoted" purple
  - approved = "Approved" indigo
  - scheduled = "Scheduled" amber
  - in_progress = "In Progress" orange
  - completed = "Completed" green
  - verified = "Verified" dark green
  - closed = "Closed" grey
  - cancelled = "Cancelled" grey strikethrough
  - on_hold = "On Hold" slate
- **Contractor** (name or "Unassigned")
- **Days Open** (number, colour: green <7, amber 7-14, red >14)
- **Cost** (quoted or invoice amount, £XX)
- **Reported** (date)

**Filters:**
- Status: Open (default: all non-closed/cancelled) / All / Specific status
- Priority: All / Emergency / Urgent / Medium / Low
- Category: dropdown
- Property: dropdown
- Entity: dropdown
- Contractor: dropdown
- Date range: reported between dates

**Sort:** Priority (default), days open, reported date, cost

### Report New Issue Button

Prominent "Report Issue" button in top right. Opens the issue reporting modal.

---

## UI — Report Issue Modal

**Section 1 — Where:**
- **Property** (searchable dropdown, required)
- **Room** (dropdown filtered to selected property's rooms + "Communal Areas" + "External/Garden" options. Optional — not all issues are room-specific.)
- **Tenant** (auto-fill from room's current tenant if room selected. Allow override. Optional.)
- **Location Detail** (text, optional — "Upstairs bathroom", "Rear garden wall", "Kitchen under sink")

**Section 2 — What:**
- **Category** (dropdown of all categories, required)
- **Title** (text, required — auto-suggest based on category: selecting "plumbing" suggests "Plumbing issue at [property]")
- **Description** (textarea, required — placeholder: "Describe the issue in detail. What is the problem? When did it start? How severe is it?")
- **Photos** (multi-file upload, optional — accept jpg, png, webp. Upload to Supabase Storage bucket 'maintenance-photos'. Store URLs in photo_urls array.)

**Section 3 — Urgency:**
- **Priority** (radio buttons, required):
  - **Emergency** — "Danger to life or property. Gas leak, flooding, fire damage, no heating in winter, security breach." Red background.
  - **Urgent** — "Significant impact on habitability. No hot water, broken boiler (summer), major leak contained, broken lock." Amber background.
  - **Medium** — "Needs attention within 1-2 weeks. Dripping tap, minor damp patch, faulty appliance, cosmetic damage." Default.
  - **Low** — "Non-urgent improvement. Painting touch-up, garden maintenance, minor cosmetic."
- **Is Emergency** (auto-set to true if priority = emergency)

**Section 4 — Reported By:**
- **Reported By** (dropdown: Tenant, Operator, Contractor, Inspector, Agent — default Operator)

**Notes** (textarea, optional)

**On save:**
1. Create maintenance_request with status = 'reported'
2. Auto-create a system comment: "Issue reported by [reported_by] on [date]"
3. If priority = emergency, show a red alert: "EMERGENCY: This has been flagged as an emergency. Consider contacting a contractor immediately."
4. Redirect to the request detail view

---

## UI — Maintenance Request Detail View

Clicking a request from the list opens a full detail page.

**Header:**
- Title (large)
- Priority badge (large), status badge, category badge
- Emergency indicator if applicable: red "EMERGENCY" banner across top
- Recurring indicator if applicable: amber "RECURRING ISSUE" badge with link to previous related request
- Property address (clickable) — Room name
- Reported by + reported date
- Days open counter

**Two-Column Layout:**

### Left Column — Issue Details & Timeline

**Issue Details Card:**
- Category, priority, description
- Location detail
- Reported by, reported date
- Photos (thumbnail grid, clickable to expand)
- "Edit" button for updating details

**Activity Timeline:**
Chronological feed of all maintenance_comments for this request, plus system-generated events. Each entry shows:
- Author avatar placeholder (coloured circle: blue for operator, green for tenant, orange for contractor, grey for system)
- Author name + type badge
- Timestamp (relative)
- Comment text
- Photos if attached
- Internal comments (is_internal = true) shown with a "Internal Note" badge and slightly greyed background — these would be hidden from tenants in a future tenant portal

**Add Comment Form:**
At the bottom of the timeline:
- Comment text (textarea, required)
- Photo upload (optional)
- "Internal note" toggle (default off — when on, marks as internal/operator-only)
- "Add as" dropdown: Operator (default), Contractor, System
- Post button

### Right Column — Works Order & Actions

**Works Order Card:**

If no works order exists:
- "Create Works Order" button (prominent)

If works order exists, show the current works order:

**Works Order Status Pipeline:**
A horizontal status pipeline showing progression:
```
Draft → Sent → Quote Received → Approved → Scheduled → In Progress → Completed → Invoiced → Paid
```
Current status highlighted. Completed statuses have green checkmarks.

**Works Order Details:**
- Order number (auto-generated: WO-YYYY-NNNN)
- Status badge
- Contractor: name, phone (clickable), email (clickable)
- Scheduled date + time slot
- Tenant access required: Yes/No — if yes, show tenant notification status

**Cost Tracking:**
- Quoted: £XX.XX (date)
- Approved: £XX.XX (date)
- Invoiced: £XX.XX (reference, date)
- Paid: £XX.XX (date, method)

Show these as a vertical progression — each line appears as it's filled in.

**Completion Details** (visible when status = completed or later):
- Completion date
- Completion notes
- Before/after photos (side-by-side comparison if both exist)
- Warranty: X months (expiry date)

**Action Buttons** (context-dependent based on current status):

When status = 'reported' or 'triaged':
- "Create Works Order" — opens works order creation form

When works order status = 'draft':
- "Assign Contractor" — contractor selector
- "Send to Contractor" — advances to 'sent_to_contractor'

When status = 'sent_to_contractor':
- "Record Quote" — opens quote form (amount, date)
- Advances status to 'quote_received'

When status = 'quote_received':
- "Approve Quote" — sets approved_amount = quoted_amount, advances to 'approved'
- "Request New Quote" — resets to 'sent_to_contractor' with comment
- "Reject & Cancel" — cancels works order with reason

When status = 'approved':
- "Schedule Job" — date picker + time slot selector. Sets scheduled_date. Advances to 'scheduled'.
- "Notify Tenant" — sets tenant_notified = true, creates system comment. (Placeholder for actual email/SMS in future.)

When status = 'scheduled':
- "Mark In Progress" — advances to 'in_progress'
- "Reschedule" — update scheduled date with reason comment

When status = 'in_progress':
- "Mark Complete" — opens completion form: completion date, notes, completion photos, warranty months. Advances to 'completed'.

When status = 'completed':
- "Verify & Close" — operator verifies work quality. Sets maintenance_request status to 'verified' then 'closed'. 
- "Record Invoice" — invoice amount, reference, date. Advances to 'invoiced'.
- "Raise Dispute" — adds dispute comment, sets status to 'disputed'.

When status = 'invoiced':
- "Record Payment" — paid amount, date, method. Advances to 'paid'.

When status = 'paid':
- "Close Request" — closes the parent maintenance_request.

**Quick Close** (available at any status):
- "Cancel Request" — asks for cancellation reason, sets both request and works order to cancelled.

---

## UI — Create Works Order Form

Opens as a modal from the request detail page.

**Fields:**
- **Maintenance Request** (read-only, linked)
- **Property** (read-only, from request)
- **Description** (textarea, pre-filled from request description. Editable — the works order description may differ from the initial report.)
- **Contractor** (searchable dropdown from compliance_contractors, filtered by service_types matching the request category. Show contractor name, phone, rating. Include "Other / Manual Entry" option.)
- **Manual Contractor Fields** (shown if "Other" selected): contractor name, phone, email
- **Tenant Access Required** (toggle, default true)
- **Notes** (textarea)

**On save:**
1. Create works_order with status = 'draft'
2. Generate order_number: "WO-" + year + "-" + sequential 4-digit number
3. Update maintenance_request status to 'triaged'
4. Add system comment: "Works order WO-XXXX-XXXX created and assigned to [contractor]"

---

## UI — Maintenance Analytics

A sub-tab within the Maintenance page, or a collapsible section below the request list.

### Spend by Property

Table from `maintenance_spend_by_property`:
- Property address, entity name, total jobs, completed jobs, total invoiced, total paid, avg job cost, avg resolution days
- Sort by total paid descending
- Properties with spend above 15% of annual rent should be flagged in red — the maintenance spend ratio KPI from the audit

### Spend by Category

Donut chart from `maintenance_spend_by_category`:
- Each category as a segment, sized by total_spend
- Table below showing: category, job count, total spend, avg cost, avg resolution days
- This reveals where the money goes — if 40% of spend is on plumbing, that property might have a systemic pipe issue

### Contractor Performance

Table from `contractor_performance`:
- Contractor name, service types, total jobs, completed jobs, total paid, avg cost, avg days over schedule, disputed jobs, rating
- Sort by completed jobs descending
- Highlight contractors with disputed jobs in amber
- Highlight contractors with avg days over schedule > 3 in red

### Trends Chart

Line chart showing monthly maintenance spend over the last 12 months:
- X-axis: months
- Y-axis: £
- Line: total invoiced per month
- Optional secondary line: job count per month
- This shows whether maintenance costs are trending up (potential capital improvement needed) or stable

### Recurring Issues

Flag maintenance requests where is_recurring = true or where the same property + category combination has 3+ requests in the last 12 months. Show as a warning list:

"Recurring Issues Detected:"
- "14 High Street — Plumbing — 4 requests in 12 months"
- "22 Mill Lane — Damp & Mould — 3 requests in 12 months"

This is operationally critical — a property with recurring plumbing issues probably needs capital pipe replacement, not another patch repair. The system should surface these patterns that humans miss when managing 50 properties.

To detect this automatically, create a view:

```sql
create or replace view public.recurring_issue_detection as
select
  mr.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  mr.category,
  count(*) as request_count,
  min(mr.reported_date) as first_reported,
  max(mr.reported_date) as last_reported,
  coalesce(sum(wo.invoice_amount), 0) as total_spend
from public.maintenance_requests mr
join public.properties p on p.id = mr.property_id
left join public.works_orders wo on wo.maintenance_request_id = mr.id and wo.status not in ('cancelled')
where mr.reported_date >= current_date - interval '12 months'
  and mr.status not in ('cancelled')
group by mr.property_id, p.address_line_1, p.postcode, mr.category
having count(*) >= 3
order by count(*) desc;
```

---

## UI — Update Property Detail Page

Add a **Maintenance** section to the Property Detail page:

**Section Header:**
- "Maintenance" title
- Open requests count badge (red if > 0)
- Total spend this year: £XX,XXX
- "Report Issue" button

**Active Requests:**
- List of open maintenance requests for this property
- Each shows: priority icon, title, category badge, status badge, days open, contractor (if assigned)
- Click to open request detail

**Recent Completed:**
- Last 5 completed requests
- Each shows: title, category, completion date, cost

**Spend Summary:**
- Small donut chart: maintenance spend by category for this property in the last 12 months
- Total spend this year vs last year comparison

---

## UI — Update Room Detail Page

If a maintenance request is linked to a specific room, show it on the Room Detail page:

- "Maintenance History" section
- List of all requests for this room, ordered by reported_date descending
- Useful for spotting room-specific issues (e.g. Room 3 always has damp problems)

---

## UI — Update Tenant Detail Page

Show maintenance requests reported by or affecting a specific tenant:

- "Maintenance Requests" section on Tenant Detail
- List of requests where tenant_id matches
- Shows whether the tenant reports frequently (useful for distinguishing genuine issues from high-maintenance tenants)

---

## UI — Update Executive Command Centre

Add maintenance items to "Items Needing Attention":
- Emergency requests (any status except completed/closed)
- Requests open > 14 days
- Works orders with status 'quote_received' (awaiting approval)

Format: "[priority icon] [category] — [property address] — [title] — Open X days"

---

## Photo Storage

Create a Supabase Storage bucket named `maintenance-photos`:
- Public: false
- File size limit: 5MB
- Allowed types: image/jpeg, image/png, image/webp
- Path convention: `{property_id}/{request_id}/{filename}`

Photos should display as thumbnails in the request list and expand to full size on click. Before/after comparison on completed works orders should display side by side.

---

## Order Number Generation

Create a sequence for works order numbers:

```sql
create sequence if not exists public.works_order_seq start with 1;

create or replace function public.generate_works_order_number()
returns text as $$
begin
  return 'WO-' || extract(year from current_date)::text || '-' || lpad(nextval('public.works_order_seq')::text, 4, '0');
end;
$$ language plpgsql;
```

---

## Human-Readable Category Names

```typescript
export const MAINTENANCE_CATEGORY_NAMES: Record<string, string> = {
  plumbing: 'Plumbing',
  electrical: 'Electrical',
  heating: 'Heating & Boilers',
  structural: 'Structural',
  damp_mould: 'Damp & Mould',
  pest_control: 'Pest Control',
  appliance: 'Appliances',
  locks_security: 'Locks & Security',
  windows_doors: 'Windows & Doors',
  flooring: 'Flooring',
  painting_decorating: 'Painting & Decorating',
  garden_external: 'Garden & External',
  cleaning: 'Cleaning',
  fire_safety: 'Fire Safety Equipment',
  furniture: 'Furniture',
  communal_areas: 'Communal Areas',
  roof_guttering: 'Roof & Guttering',
  drainage: 'Drainage',
  other: 'Other',
};
```

---

## Design

- Emergency requests must dominate the screen when they exist. Red banner, pulsing indicator, top of every list. A gas leak at an HMO with 6 sleeping tenants is a life-safety issue.
- The works order status pipeline on the detail page is the key UX innovation here. It makes the current state of a job immediately obvious and shows what the next action is. No more "where are we with the plumber at number 14?"
- The activity timeline should feel like a conversation thread. Operators, contractors, and the system all contribute. When tenant-facing features are added later, tenants will see the non-internal comments. Design for this now.
- Before/after photos are powerful for dispute resolution and quality verification. Make the side-by-side comparison visually clear.
- The recurring issue detection is a strategic feature. It transforms reactive maintenance into proactive capital planning. A property with 4 plumbing callouts in a year needs a re-pipe, not another patch. Surface this prominently.
- Contractor performance data builds over time. After 6 months of tracking, you will know which contractors are fast, cheap, reliable, and which are slow, expensive, and disputatious. This data is worth money — it informs every future contractor decision.

## TypeScript

Generate types for: maintenance_requests, works_orders, maintenance_comments. Type the views: `MaintenanceOverview`, `MaintenanceSpendByProperty`, `MaintenanceSpendByCategory`, `ContractorPerformance`, `RecurringIssueDetection`. Create union types for `MaintenanceCategory`, `MaintenancePriority`, `MaintenanceStatus`, `WorksOrderStatus`.
