# HydrogenCap Implementation Specification
## Phase 7: Tenant Management Suite - Summary

A complete tenant management system with 4 core modules.

---

# Overview

| Module | Purpose | Priority |
|--------|---------|----------|
| **1. Tenant Database** | Track who lives where | HIGH |
| **2. Rent Collection** | Track rent at tenant level | HIGH |
| **3. Maintenance Requests** | Tenants report issues | MEDIUM |
| **4. Tenant Portal** | Self-service for tenants | MEDIUM |

---

# Module 1: Tenant Database

## Tables
- `rooms` - Individual rooms within HMO properties
- `tenants` - Tenant profiles with contact, employment, guarantor info
- `tenancies` - Links tenant to room with dates, rent, deposit

## Key Features
- Room management per property (name, type, rent, status)
- Tenant profiles with full contact/reference data
- Tenancy records with start/end dates, rent amount
- Auto-update room status when tenancy changes
- Deposit protection tracking

## Pages
- `/tenants` - List all tenants with search/filter
- `/tenants/:id` - Tenant detail with tenancy history
- Property detail gets new "Rooms" tab

---

# Module 2: Rent Collection

## Tables
- `rent_schedule` - Auto-generated rent due dates per tenancy
- `rent_payments` - Individual payment records

## Key Features
- Auto-generate 12-month rent schedule when tenancy created
- Track: upcoming, due, paid, partial, overdue
- Quick "Mark as Paid" action
- Record partial payments
- Arrears view with days overdue
- Monthly summary: expected vs received vs outstanding
- Collection rate percentage

## Pages
- `/rent` - Rent collection dashboard
  - Month navigator
  - Summary cards (expected, received, outstanding)
  - Arrears alert
  - Rent schedule list with status badges
  - Quick payment recording

## Dashboard Widgets
- Rent summary card (this month)
- Arrears count badge
- Collection rate

---

# Module 3: Maintenance Requests

## Tables
- `maintenance_requests` - Tenant-submitted issues
- `maintenance_updates` - Timeline of status changes/notes

## Key Features
- Categories: plumbing, electrical, heating, appliance, damp/mould, etc.
- Urgency levels: emergency, urgent, normal, low
- Photo upload by tenant
- Status workflow: new → acknowledged → scheduled → in_progress → completed → closed
- Internal notes (manager only) vs tenant notes (visible)
- Link to contractor jobs system
- Tenant feedback/rating after completion

## Pages
- `/maintenance` - All requests with filters
- `/maintenance/:id` - Request detail with timeline

## Integration
- "Create Job" button converts request to contractor job
- Job status updates reflect back to request

---

# Module 4: Tenant Portal

## Routes (Separate from main app)
```
/portal              - Dashboard
/portal/rent         - View rent schedule & payments
/portal/maintenance  - View & report issues
/portal/documents    - View & acknowledge documents
/portal/profile      - Update contact details
```

## Key Features
- Tenant login via magic link (no password)
- Dashboard with quick actions
- View rent due and payment history
- Report maintenance issues with photos
- View and acknowledge documents (tenancy agreement, certificates)
- Update contact details and emergency contact

## Tenant-Visible Data
- Their rent schedule (not other tenants)
- Their maintenance requests
- Documents marked `visible_to_tenant = true`
- Status updates marked `visible_to_tenant = true`

---

# Database Schema Summary

```
rooms
├── property_id (FK)
├── room_name, room_number, floor
├── room_type (single/double/ensuite/studio)
├── target_rent_pcm
├── status (vacant/occupied/notice/maintenance)
└── photos, description

tenants
├── first_name, last_name, dob
├── email, phone, emergency_contact
├── employment_status, employer, income
├── guarantor details
├── portal_user_id (for login)
└── status (prospect/active/past/blacklisted)

tenancies
├── tenant_id, room_id, property_id
├── start_date, end_date
├── rent_amount_pcm, rent_due_day
├── deposit_amount, deposit_scheme
├── tenancy_agreement_url
└── status (pending/active/notice/ended)

rent_schedule
├── tenancy_id
├── due_date, period_start, period_end
├── rent_amount, additional_charges
├── amount_paid, amount_outstanding
├── status (upcoming/due/paid/partial/overdue)
└── reminder_sent_at, warning_sent_at

rent_payments
├── tenancy_id, rent_schedule_id
├── amount, payment_date
├── payment_method, reference
└── is_reconciled

maintenance_requests
├── property_id, room_id, tenant_id
├── category, title, description, location
├── urgency (emergency/urgent/normal/low)
├── photos
├── status (new/acknowledged/scheduled/in_progress/completed/closed)
├── contractor_job_id (link to jobs)
└── tenant_rating, tenant_feedback

maintenance_updates
├── request_id
├── update_type, message, new_status
├── visible_to_tenant
└── created_by_type (manager/tenant/contractor)
```

---

# Implementation Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| 1 | Database | All tables, triggers, functions, RLS |
| 2 | Rooms & Tenants | Room management, tenant CRUD, tenancy creation |
| 3 | Rent Collection | Schedule generation, payment recording, arrears |
| 4 | Maintenance | Request creation, status workflow, job linking |
| 5 | Tenant Portal | Portal routes, dashboard, rent view, issue reporting |
| 6 | Integration | Dashboard widgets, property detail tabs, polish |

---

# Key Automations

1. **Room status updates** - When tenancy starts/ends, room status auto-updates
2. **Rent schedule generation** - Creates 12 months of rent due dates when tenancy created
3. **Payment status updates** - When payment recorded, schedule item status updates
4. **Arrears detection** - View shows all overdue rent with days count
5. **Job creation** - One-click convert maintenance request to contractor job

---

# Navigation Updates

Add to sidebar:
```tsx
{ title: 'Tenants', icon: Users, href: '/tenants' },
{ title: 'Rent', icon: PoundSterling, href: '/rent' },
{ title: 'Maintenance', icon: Wrench, href: '/maintenance' },
```

Add to property detail:
- "Rooms" tab showing all rooms with occupancy

---

# Files to Create

## Database
- `supabase/migrations/YYYYMMDD_tenant_management.sql`

## Hooks
- `src/hooks/useRooms.ts`
- `src/hooks/useTenants.ts`
- `src/hooks/useTenancies.ts`
- `src/hooks/useRentCollection.ts`
- `src/hooks/useMaintenanceRequests.ts`
- `src/hooks/useTenantPortal.ts`

## Pages
- `src/pages/Tenants.tsx`
- `src/pages/TenantDetail.tsx`
- `src/pages/RentCollection.tsx`
- `src/pages/MaintenanceRequests.tsx`
- `src/pages/MaintenanceDetail.tsx`
- `src/pages/portal/PortalDashboard.tsx`
- `src/pages/portal/PortalRent.tsx`
- `src/pages/portal/PortalMaintenance.tsx`
- `src/pages/portal/ReportIssue.tsx`
- `src/pages/portal/PortalDocuments.tsx`

## Components
- `src/components/tenants/AddTenantDialog.tsx`
- `src/components/tenants/CreateTenancyDialog.tsx`
- `src/components/tenants/TenantCard.tsx`
- `src/components/rooms/RoomCard.tsx`
- `src/components/rooms/AddRoomDialog.tsx`
- `src/components/rent/RecordPaymentDialog.tsx`
- `src/components/rent/RentScheduleTable.tsx`
- `src/components/rent/ArrearsWidget.tsx`
- `src/components/maintenance/MaintenanceCard.tsx`
- `src/components/maintenance/CreateRequestDialog.tsx`
- `src/components/maintenance/UpdateStatusDialog.tsx`
- `src/components/maintenance/RequestTimeline.tsx`

---

# Detailed Implementation

The full implementation with complete code is available in the companion document:
**HydrogenCap_Tenant_Management_Full.md**

This includes:
- Complete SQL migration (500+ lines)
- All React hooks with TypeScript types
- Full page components
- Dialog components
- Tenant portal components

---

*Ready for Lovable.dev implementation - 6 weeks estimated*
