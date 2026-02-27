# HydrogenCap — NEXT Phase 2.2: Compliance Notification Cascade

## Context

HydrogenCap now has a full compliance engine: requirements per property, document storage with versioning, a compliance matrix dashboard, and status calculation. But it is still passive — it shows you what is expiring, but it does not do anything about it. The operator has to remember to check the dashboard, spot the amber and red items, and manually take action.

At 50 HMOs with 10+ compliance document types each, that is 500+ compliance items to monitor. Some expire annually, some every 5 years, some have no expiry. The operator cannot hold this in their head. The system must proactively manage the compliance lifecycle: detect upcoming expiries, generate tasks, notify the right people, escalate if ignored, and track resolution through to completion.

This module transforms compliance from a dashboard into a workflow engine.

## Database Tables

### `compliance_tasks`

Each compliance event (expiry, renewal, new requirement) generates a task that tracks the full workflow from detection to resolution:

```sql
create table public.compliance_tasks (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  document_type text not null,
  compliance_requirement_id uuid references public.compliance_requirements(id),
  compliance_document_id uuid references public.compliance_documents(id),
  task_type text not null check (task_type in (
    'renewal_due',
    'expired',
    'missing_document',
    'new_requirement',
    'follow_up',
    'inspection_scheduled',
    'certificate_received',
    'upload_pending'
  )),
  title text not null,
  description text,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'completed', 'cancelled', 'overdue')),
  assigned_to text,
  due_date date,
  escalation_level integer default 0,
  last_escalated_at timestamptz,
  contractor_id uuid references public.compliance_contractors(id),
  contractor_booked_date date,
  inspection_date date,
  quoted_cost numeric(8,2),
  actual_cost numeric(8,2),
  resolution_notes text,
  resolved_at timestamptz,
  resolved_by uuid,
  source text default 'auto' check (source in ('auto', 'manual')),
  trigger_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_compliance_tasks_property on public.compliance_tasks(property_id);
create index idx_compliance_tasks_document_type on public.compliance_tasks(document_type);
create index idx_compliance_tasks_status on public.compliance_tasks(status);
create index idx_compliance_tasks_priority on public.compliance_tasks(priority);
create index idx_compliance_tasks_due_date on public.compliance_tasks(due_date);
create index idx_compliance_tasks_assigned on public.compliance_tasks(assigned_to);
```

### `notification_log`

Immutable log of every notification sent. Used for audit trail and to prevent duplicate notifications:

```sql
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  compliance_task_id uuid references public.compliance_tasks(id),
  property_id uuid references public.properties(id),
  document_type text,
  notification_type text not null check (notification_type in (
    'expiry_90_day',
    'expiry_60_day',
    'expiry_30_day',
    'expiry_14_day',
    'expiry_7_day',
    'expired',
    'escalation_1',
    'escalation_2',
    'escalation_3',
    'task_assigned',
    'task_overdue',
    'inspection_reminder',
    'resolution_confirmed',
    'missing_document',
    'custom'
  )),
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'sms', 'webhook')),
  recipient text,
  subject text,
  message text not null,
  status text not null default 'sent' check (status in ('pending', 'sent', 'delivered', 'failed', 'read', 'dismissed')),
  sent_at timestamptz default now(),
  read_at timestamptz,
  metadata jsonb
);

create index idx_notification_log_task on public.notification_log(compliance_task_id);
create index idx_notification_log_property on public.notification_log(property_id);
create index idx_notification_log_type on public.notification_log(notification_type);
create index idx_notification_log_status on public.notification_log(status);
create index idx_notification_log_sent_at on public.notification_log(sent_at);
```

### `notification_preferences`

User-configurable notification settings:

```sql
create table public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  notification_category text not null check (notification_category in (
    'compliance_expiry',
    'compliance_expired',
    'compliance_missing',
    'task_assigned',
    'task_overdue',
    'arrears_alert',
    'void_alert',
    'covenant_alert',
    'refinance_alert',
    'general'
  )),
  in_app_enabled boolean default true,
  email_enabled boolean default true,
  email_address text,
  sms_enabled boolean default false,
  sms_number text,
  advance_days integer[],
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, notification_category)
);
```

### `escalation_rules`

Configurable escalation thresholds:

```sql
create table public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  document_type text,
  rule_name text not null,
  trigger_condition text not null check (trigger_condition in (
    'days_before_expiry',
    'days_after_expiry',
    'task_open_days',
    'task_overdue_days'
  )),
  trigger_value integer not null,
  action_type text not null check (action_type in (
    'create_task',
    'send_notification',
    'escalate_priority',
    'assign_to',
    'send_email',
    'flag_critical'
  )),
  action_config jsonb,
  escalation_level integer default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- Seed default escalation rules
insert into public.escalation_rules (document_type, rule_name, trigger_condition, trigger_value, action_type, action_config, escalation_level) values
  -- 90 days before expiry: create renewal task
  (null, '90-day renewal reminder', 'days_before_expiry', 90, 'create_task', '{"task_type": "renewal_due", "priority": "low"}', 0),
  -- 60 days: send notification, raise priority
  (null, '60-day warning', 'days_before_expiry', 60, 'send_notification', '{"notification_type": "expiry_60_day", "channel": "in_app"}', 0),
  -- 30 days: escalate to high priority
  (null, '30-day escalation', 'days_before_expiry', 30, 'escalate_priority', '{"new_priority": "high"}', 1),
  -- 14 days: critical notification
  (null, '14-day critical warning', 'days_before_expiry', 14, 'send_notification', '{"notification_type": "expiry_14_day", "channel": "in_app"}', 1),
  -- 7 days: critical escalation
  (null, '7-day final warning', 'days_before_expiry', 7, 'flag_critical', '{"new_priority": "critical"}', 2),
  -- Expired: immediate critical notification
  (null, 'Expired alert', 'days_after_expiry', 0, 'send_notification', '{"notification_type": "expired", "channel": "in_app"}', 2),
  -- 7 days after expiry: escalation 3
  (null, '7-day overdue escalation', 'days_after_expiry', 7, 'send_notification', '{"notification_type": "escalation_2", "channel": "in_app"}', 3),
  -- HMO licence specific: 6 months before (longer lead time)
  ('hmo_licence', 'HMO licence 6-month warning', 'days_before_expiry', 180, 'create_task', '{"task_type": "renewal_due", "priority": "medium"}', 0),
  -- HMO licence: 3 months before
  ('hmo_licence', 'HMO licence 3-month escalation', 'days_before_expiry', 90, 'escalate_priority', '{"new_priority": "high"}', 1),
  -- Gas safety: 6 weeks before (tight turnaround)
  ('gas_safety_certificate', 'Gas safety 6-week reminder', 'days_before_expiry', 42, 'create_task', '{"task_type": "renewal_due", "priority": "high"}', 0);
```

### RLS Policies

```sql
alter table public.compliance_tasks enable row level security;
alter table public.notification_log enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.escalation_rules enable row level security;

create policy "Authenticated access" on public.compliance_tasks for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Authenticated access" on public.notification_log for all using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Users manage own preferences" on public.notification_preferences for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Authenticated access" on public.escalation_rules for all using (auth.uid() is not null) with check (auth.uid() is not null);
```

### Audit Triggers

```sql
create trigger audit_compliance_tasks after insert or update or delete on public.compliance_tasks for each row execute function public.audit_trigger_function();
```

### Compliance Scan Function

This is the core engine. It scans the compliance_matrix, evaluates escalation_rules, and creates/updates tasks and notifications. It should be called daily (via Supabase cron or a manual "Run Scan" button):

```sql
create or replace function public.run_compliance_scan()
returns jsonb as $$
declare
  result jsonb := '{"tasks_created": 0, "tasks_updated": 0, "notifications_sent": 0}'::jsonb;
  item record;
  rule record;
  days_until integer;
  days_since integer;
  existing_task record;
  new_task_id uuid;
  tasks_created integer := 0;
  tasks_updated integer := 0;
  notifications_sent integer := 0;
begin
  -- Iterate through all compliance matrix items that are required
  for item in
    select * from public.compliance_matrix
    where is_required = true
  loop
    days_until := item.days_remaining;
    days_since := case
      when item.calculated_status = 'expired' then -item.days_remaining
      when item.calculated_status = 'missing' then null
      else null
    end;

    -- Check each escalation rule
    for rule in
      select * from public.escalation_rules
      where is_active = true
        and (document_type is null or document_type = item.document_type)
      order by trigger_value desc
    loop
      -- Evaluate trigger condition
      if (
        (rule.trigger_condition = 'days_before_expiry' and days_until is not null and days_until <= rule.trigger_value and days_until >= 0)
        or
        (rule.trigger_condition = 'days_after_expiry' and days_since is not null and days_since >= rule.trigger_value)
        or
        (rule.trigger_condition = 'days_before_expiry' and item.calculated_status = 'missing' and rule.trigger_value <= 90)
      ) then
        -- Check if we already have an open task for this property + document type
        select * into existing_task from public.compliance_tasks
        where property_id = item.property_id
          and document_type = item.document_type
          and status not in ('completed', 'cancelled')
        order by created_at desc limit 1;

        -- Action: create_task
        if rule.action_type = 'create_task' and existing_task is null then
          insert into public.compliance_tasks (
            property_id, document_type, compliance_requirement_id,
            compliance_document_id, task_type, title, description,
            priority, due_date, source, trigger_date
          ) values (
            item.property_id,
            item.document_type,
            item.requirement_id,
            item.document_id,
            (rule.action_config->>'task_type')::text,
            'Renew ' || item.document_type || ' for ' || item.property_address,
            case
              when item.calculated_status = 'missing' then 'No current document on file. Upload required.'
              when days_until is not null then 'Expires in ' || days_until || ' days (' || item.expiry_date || ')'
              else 'Action required'
            end,
            coalesce((rule.action_config->>'priority')::text, 'medium'),
            coalesce(item.expiry_date, current_date + interval '30 days'),
            'auto',
            current_date
          )
          returning id into new_task_id;
          tasks_created := tasks_created + 1;
        end if;

        -- Action: escalate_priority
        if rule.action_type in ('escalate_priority', 'flag_critical') and existing_task is not null then
          update public.compliance_tasks
          set priority = coalesce((rule.action_config->>'new_priority')::text, 'high'),
              escalation_level = greatest(escalation_level, rule.escalation_level),
              last_escalated_at = now(),
              updated_at = now()
          where id = existing_task.id
            and escalation_level < rule.escalation_level;
          tasks_updated := tasks_updated + 1;
        end if;

        -- Action: send_notification (check for duplicate in last 24 hours)
        if rule.action_type = 'send_notification' then
          if not exists (
            select 1 from public.notification_log
            where property_id = item.property_id
              and document_type = item.document_type
              and notification_type = (rule.action_config->>'notification_type')::text
              and sent_at > now() - interval '24 hours'
          ) then
            insert into public.notification_log (
              compliance_task_id, property_id, document_type,
              notification_type, channel, message
            ) values (
              coalesce(new_task_id, existing_task.id),
              item.property_id,
              item.document_type,
              (rule.action_config->>'notification_type')::text,
              coalesce((rule.action_config->>'channel')::text, 'in_app'),
              case
                when item.calculated_status = 'expired' then
                  item.document_type || ' for ' || item.property_address || ' has EXPIRED. Immediate action required.'
                when item.calculated_status = 'missing' then
                  item.document_type || ' is MISSING for ' || item.property_address || '. Upload or arrange inspection.'
                else
                  item.document_type || ' for ' || item.property_address || ' expires in ' || days_until || ' days.'
              end
            );
            notifications_sent := notifications_sent + 1;
          end if;
        end if;

      end if;
    end loop;
  end loop;

  -- Auto-close tasks where document has been renewed
  update public.compliance_tasks ct
  set status = 'completed',
      resolved_at = now(),
      resolution_notes = 'Auto-resolved: current valid document found',
      updated_at = now()
  from public.compliance_matrix cm
  where ct.property_id = cm.property_id
    and ct.document_type = cm.document_type
    and cm.calculated_status = 'valid'
    and ct.status not in ('completed', 'cancelled');

  result := jsonb_build_object(
    'tasks_created', tasks_created,
    'tasks_updated', tasks_updated,
    'notifications_sent', notifications_sent,
    'scan_date', current_date
  );

  return result;
end;
$$ language plpgsql security definer;
```

### Compliance Task Summary Views

```sql
create or replace view public.compliance_task_overview as
select
  ct.id as task_id,
  ct.property_id,
  p.address_line_1 || ', ' || p.postcode as property_address,
  le.entity_name,
  ct.document_type,
  ct.task_type,
  ct.title,
  ct.priority,
  ct.status,
  ct.assigned_to,
  ct.due_date,
  ct.escalation_level,
  ct.contractor_id,
  cc.company_name as contractor_name,
  ct.inspection_date,
  ct.quoted_cost,
  ct.source,
  ct.created_at,
  ct.updated_at,
  case
    when ct.due_date < current_date and ct.status not in ('completed', 'cancelled') then true
    else false
  end as is_overdue,
  case
    when ct.due_date is not null then ct.due_date - current_date
    else null
  end as days_until_due
from public.compliance_tasks ct
join public.properties p on p.id = ct.property_id
join public.legal_entities le on le.id = p.entity_id
left join public.compliance_contractors cc on cc.id = ct.contractor_id
order by
  case ct.priority
    when 'critical' then 0
    when 'high' then 1
    when 'medium' then 2
    when 'low' then 3
  end,
  ct.due_date asc nulls last;
```

```sql
create or replace view public.unread_notifications as
select
  nl.*,
  ct.title as task_title,
  ct.priority as task_priority,
  p.address_line_1 || ', ' || p.postcode as property_address
from public.notification_log nl
left join public.compliance_tasks ct on ct.id = nl.compliance_task_id
left join public.properties p on p.id = nl.property_id
where nl.status in ('sent', 'delivered')
  and nl.read_at is null
order by nl.sent_at desc;
```

---

## UI — Compliance Tasks Page

Add a **Tasks** page accessible from the sidebar (icon: 📋, label: "Tasks"). Position after Compliance.

### Task Summary Stats Bar

4 stat cards:

1. **Open Tasks** — count where status in ('open', 'in_progress', 'waiting'). If > 10, amber. If > 20, red.
2. **Overdue Tasks** — count where is_overdue = true. Red if > 0. Zero tolerance.
3. **Critical Priority** — count where priority = 'critical' and status not in ('completed', 'cancelled'). Red background if > 0.
4. **Completed This Month** — count where status = 'completed' and resolved_at >= first of current month. Green. Shows progress.

### Task Board

Display tasks in a **kanban-style board** with columns for each status:

**Columns:**
- **Open** (new tasks, not yet started)
- **In Progress** (being worked on — contractor booked, waiting for inspection)
- **Waiting** (blocked — waiting for contractor availability, council response, etc.)
- **Completed** (resolved — document uploaded, certificate received)

Each task card in the board shows:
- **Title** (e.g. "Renew Gas Safety Certificate for 14 High Street")
- **Priority badge**: critical = red pulsing, high = red, medium = amber, low = blue
- **Document type** in small text
- **Property address** in small grey text
- **Due date** with days remaining/overdue. Red if overdue.
- **Assigned to** (name or "Unassigned" in grey)
- **Contractor** (if booked, show company name)
- **Escalation level** indicator: small dots (0=none, 1=one amber dot, 2=two red dots, 3=three red dots)
- **Source badge**: "Auto" grey or "Manual" blue

**Drag and drop** between columns to change status. If Lovable cannot implement drag-and-drop, use a status dropdown on each card instead.

**Alternative: List View Toggle**
Provide a toggle between Board View and List View. List view shows the same data as a sortable, filterable table:

Columns: Priority, Title, Document Type, Property, Assigned To, Due Date, Days Remaining, Status, Escalation, Contractor, Actions

### Task Filters

Above the board/list:
- **Priority**: All / Critical / High / Medium / Low
- **Document Type**: dropdown of all compliance document types
- **Property**: dropdown
- **Entity**: dropdown
- **Assigned To**: dropdown (of assigned_to values + "Unassigned")
- **Source**: All / Auto-generated / Manual
- **Show Completed**: toggle (off by default — only show active tasks)

### Create Manual Task

"Create Task" button opens a modal:

- **Property** (dropdown, required)
- **Document Type** (dropdown, required)
- **Task Type** (dropdown: Renewal Due, Missing Document, Follow Up, Inspection Scheduled, Certificate Received, Upload Pending — required)
- **Title** (text, required — auto-generate suggestion from property + document type)
- **Description** (textarea, optional)
- **Priority** (dropdown: Critical, High, Medium, Low — default Medium)
- **Assigned To** (text input — free text for now, until user management is built)
- **Due Date** (date picker, optional)
- **Contractor** (dropdown from compliance_contractors, optional)
- **Notes** (textarea, optional)

### Task Detail View

Clicking a task card opens a detail panel (slide-over or modal):

**Header:**
- Title (large)
- Priority badge, status badge, source badge
- Property address (clickable to property detail)
- Document type (human-readable name)

**Task Progress Section:**
A visual workflow timeline showing the typical compliance renewal lifecycle. Highlight the current stage:

```
Created → Assigned → Contractor Booked → Inspection Scheduled → Inspection Complete → Certificate Received → Document Uploaded → RESOLVED
```

Not every task follows every step. The timeline shows which steps have been completed (with dates) and which are pending.

**Details Card:**
- Assigned to
- Due date (with overdue indicator)
- Escalation level and last escalated timestamp
- Contractor (if assigned): company name, phone, email
- Contractor booked date
- Inspection date
- Quoted cost / actual cost
- Created date, last updated date

**Actions:**
- **Update Status** — dropdown to change status
- **Change Priority** — dropdown
- **Assign Contractor** — searchable dropdown from compliance_contractors. When selected, auto-set contractor_booked_date to today if not already set.
- **Set Inspection Date** — date picker. When set, auto-create a notification_log entry as an inspection reminder.
- **Record Cost** — fields for quoted_cost and actual_cost
- **Resolve Task** — sets status = 'completed', asks for resolution_notes. If a new compliance document has been uploaded for this property + document type since the task was created, auto-link it and show: "Linked to document uploaded on DD/MM/YYYY."
- **Cancel Task** — with reason. Sets status = 'cancelled'.

**Activity Log:**
Show all notification_log entries for this task, ordered chronologically. Each entry shows:
- Timestamp
- Notification type (human-readable)
- Channel
- Message text
- Status (sent/read)

This provides a complete audit trail of every notification and escalation for this compliance item.

**Notes Section:**
- Editable notes textarea
- Save button

---

## UI — Notification Centre

### Notification Bell

Add a **notification bell icon** to the top navigation bar (header), visible on every page.

- Show unread count as a red badge on the bell: "3" if 3 unread notifications
- If count > 0, gently pulse the badge

**Clicking the bell** opens a dropdown panel showing the 20 most recent notifications:

Each notification shows:
- **Icon** based on notification_type: warning triangle for expiry, red circle for expired, clock for reminder, check for resolution
- **Message** text (1-2 lines)
- **Property address** in small grey text
- **Relative timestamp** ("2 hours ago", "Yesterday")
- **Priority indicator** from linked task (if any)
- Unread items have a subtle blue left border and bolder text. Read items are lighter.

**Actions on each notification:**
- Click to navigate to the related task detail or compliance detail
- "Mark as read" button (or auto-mark when clicked)
- "Dismiss" button (sets status = 'dismissed')

**Footer of dropdown:**
- "Mark all as read" link
- "View all notifications" link → navigates to full notifications page

### Full Notifications Page

Accessible from "View all notifications" or from Settings.

Paginated list of all notification_log entries. Filterable by:
- Notification type
- Channel
- Status (unread / read / all)
- Date range
- Property

---

## UI — Run Compliance Scan

### Manual Scan Button

Add a "Run Compliance Scan" button in two places:
1. On the Compliance Dashboard page (top right)
2. On the Tasks page (top right)

When clicked:
1. Show a loading indicator: "Scanning compliance status across all properties..."
2. Call the `run_compliance_scan()` database function
3. Show the result: "Scan complete. X tasks created, X tasks updated, X notifications sent."
4. Refresh the page data

### Automated Scan (Future-Ready)

Add a note in Settings under a "Compliance Automation" section:

"Compliance scans run automatically when triggered manually. Automated daily scans will be available in a future update."

If Supabase cron (pg_cron) is available:

```sql
select cron.schedule(
  'daily-compliance-scan',
  '0 7 * * *',
  'select public.run_compliance_scan()'
);
```

This runs the scan every day at 7am UTC, ensuring tasks and notifications are generated before the operator starts their day.

---

## UI — Escalation Rules Management

Add an "Escalation Rules" section within Settings:

### Rules Table

Table showing all escalation_rules:

Columns:
- **Rule Name**
- **Document Type** ("All" if null, or specific type)
- **Trigger** (human-readable: "90 days before expiry", "7 days after expiry", etc.)
- **Action** (human-readable: "Create task", "Send notification", "Escalate to high priority", etc.)
- **Level** (escalation level number)
- **Active** (toggle)
- Edit / Delete buttons

### Add / Edit Rule Modal

- Rule Name (text, required)
- Document Type (dropdown: "All Document Types" + all specific types — null for all)
- Trigger Condition (dropdown: Days Before Expiry, Days After Expiry, Task Open Days, Task Overdue Days)
- Trigger Value (number — days)
- Action Type (dropdown: Create Task, Send Notification, Escalate Priority, Flag Critical)
- Action Config:
  - If Create Task: task type dropdown, priority dropdown
  - If Send Notification: notification type dropdown, channel dropdown
  - If Escalate Priority: new priority dropdown
  - If Flag Critical: auto-sets priority to critical
- Escalation Level (number 0-3)
- Active (toggle, default on)

### Default Rules Notice

Show a note: "Default escalation rules are pre-configured for common UK compliance requirements. Customise these to match your operational workflow. HMO licences have longer lead times (6 months) due to council processing delays."

---

## UI — Update Compliance Dashboard

Add task integration to the existing Compliance Matrix:

### Task Indicators on Matrix Cells

When a compliance_task exists for a property + document type combination, show an additional indicator on the matrix cell:
- Small wrench icon if task is open/in_progress
- Small clock icon if task is in 'waiting' status
- Small contractor badge if a contractor is booked

Clicking the cell now shows the Compliance Detail Modal (existing) with an additional "Active Task" section linking to the task detail if one exists.

### Task Summary Panel

Below the compliance matrix, add a "Compliance Tasks Summary" panel showing:
- Count of open tasks by priority (critical / high / medium / low)
- List of the 5 most urgent tasks (highest priority, nearest due date)
- "View all tasks" link

---

## UI — Update Property Detail

Add a "Compliance Tasks" sub-section within the property's Compliance section:

- List of active compliance tasks for this property
- Each shows: document type, priority badge, status badge, due date, assigned to
- "Create Task" button scoped to this property

---

## UI — Update Executive Command Centre

Add compliance task data to the "Items Needing Attention" panel:

- Critical and overdue compliance tasks should appear in the attention panel
- Format: "[priority badge] [document type] — [property address] — Due [date] / Overdue [X days]"
- Sort mixed with other attention items (arrears, void rooms, etc.) by urgency

Update the notification bell to be visible on the Command Centre and all pages.

---

## Human-Readable Notification Type Names

```typescript
export const NOTIFICATION_TYPE_NAMES: Record<string, string> = {
  expiry_90_day: '90-Day Expiry Warning',
  expiry_60_day: '60-Day Expiry Warning',
  expiry_30_day: '30-Day Expiry Warning',
  expiry_14_day: '14-Day Expiry Warning',
  expiry_7_day: '7-Day Final Warning',
  expired: 'Document Expired',
  escalation_1: 'Escalation Level 1',
  escalation_2: 'Escalation Level 2',
  escalation_3: 'Escalation Level 3',
  task_assigned: 'Task Assigned',
  task_overdue: 'Task Overdue',
  inspection_reminder: 'Inspection Reminder',
  resolution_confirmed: 'Task Resolved',
  missing_document: 'Missing Document',
  custom: 'Notification',
};
```

---

## Design

- The kanban task board is the primary interface for day-to-day compliance management. It must feel like a project management tool (Trello/Asana), not a data table. Cards should be scannable, drag-and-drop (or quick-status-change) should be fluid.
- Critical priority tasks must be unmissable: red border, pulsing badge, prominent position. A critical gas safety expiry is a criminal offence waiting to happen.
- The notification bell is the operator's early warning system. It must work reliably. A missed notification on a gas cert expiry could have legal consequences. The unread count must be accurate, the dropdown must load fast.
- The escalation level dots on task cards (0 to 3) provide instant visual history: "this item has been escalated twice and nobody has dealt with it." That visual pressure is intentional.
- The workflow timeline on the task detail (Created → Assigned → Booked → Inspected → Received → Uploaded → Resolved) maps to the real-world compliance renewal process. Not every task needs every step, but showing the full pipeline helps operators understand where things are stuck.
- Auto-close on document upload is critical UX: when an operator uploads a new gas safety cert, any open task for that property's gas safety should auto-resolve. No manual task management needed for the happy path.

## TypeScript

Generate types for: compliance_tasks, notification_log, notification_preferences, escalation_rules. Type the views: `ComplianceTaskOverview`, `UnreadNotification`. Create a `TaskStatus` union type. Create a `NotificationType` union type. Type the scan result as `ComplianceScanResult`.
