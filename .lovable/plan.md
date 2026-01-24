

# Portfolio Dashboard - Implementation Plan

## Overview
A professional UK property portfolio management app with a dark, fintech-inspired design. Built on Lovable Cloud with real AI-powered document processing, multi-tenant architecture, and comprehensive risk monitoring.

---

## Phase 1: Foundation & Infrastructure

### Database Architecture
Set up the complete multi-tenant data model:
- **Users & Auth** - Email/password authentication with session management
- **Organizations** - Org-based data isolation (user → org → properties)
- **Memberships** - User-to-org relationships with roles (owner/admin/viewer)
- **Properties** - Full property records with UK-specific fields (postcode areas, EPC ratings)
- **Loans** - Mortgage details, rates, expiry dates, broker info
- **Income & Costs** - Annual financial records per property
- **Documents** - AI metadata fields, extraction status, confidence scores
- **Photos** - Property images with cover photo designation
- **Activity Log** - Audit trail for all changes

### Row-Level Security
- All tables scoped to organization membership
- Future-proof for multi-tenant SaaS expansion

---

## Phase 2: Core UI Framework

### Design System
- **Dark professional theme** with accent colors (likely teal/blue for trust, amber for warnings, red for risks)
- Clean typography, subtle borders, card-based layouts
- Consistent spacing and shadows throughout

### Navigation Structure
Sidebar navigation with:
1. Dashboard (home)
2. Properties
3. Document Inbox (with badge count)
4. Import
5. Settings

---

## Phase 3: Dashboard

### Portfolio KPIs (Top Row)
- Total portfolio value (GBP formatted)
- Total mortgage balance
- Total equity
- Weighted average LTV
- Monthly net cashflow

### Rankings Section
- Top 5 properties by ROCE
- Bottom 5 properties by ROCE
- Top/Bottom by yield

### Visualizations
- **Property Map** (Leaflet/OpenStreetMap) - Pins for each property, colored by risk status
- **Lender Exposure** - Pie chart showing mortgage balance by lender
- **Area Exposure** - Bar/pie chart with toggle between area_name and postcode_area

### ⚠️ Portfolio Risks Panel
Automated risk detection with color-coded alerts:
- 🔴 **Critical**: Fixed rate expired, insurance expired, LTV >85%
- 🟡 **Warning**: Fixed rate expiring in 90 days, EPC below C, LTV >75%
- 🟢 **Compliant**: All checks passing

Clickable risks → filtered property list or direct to property detail

---

## Phase 4: Properties Management

### Properties List View
- Sortable, filterable data table
- Columns: Address, Area, Type, Beds, Value, Mortgage, LTV, Yield, ROCE, Risk Status
- Filters: Area, postcode area, property type, LTV range, EPC rating
- Quick search by address

### Property Detail View
Tabbed interface:

**Overview Tab**
- Property details card (address, type, beds, ownership)
- Financial summary (value, mortgage, equity, LTV)
- Performance metrics (yield, ROCE, cashflow)
- Property health scores (0-100 with color indicators)
- Cover photo + photo gallery

**Finance & Refinance Tab**
- Current loan details
- Rate diary (current rate, SVR, fixed expiry)
- Refinance target date & broker info
- Reminder status (6mo, 3mo, expired)
- Income & costs breakdown by year

**Costs Tab**
- Annual cost breakdown (management, bills, insurance, maintenance, compliance, other)
- Year-over-year comparison
- Trend visualization

**Documents Tab**
- Document grid/list by type
- Expiry status indicators
- Upload new document (triggers AI processing)
- View/download documents

**Photos Tab**
- Photo gallery with drag-to-reorder
- Set cover photo
- Upload multiple photos

**Activity Timeline Tab**
- Chronological log of all changes
- Entry types: valuation, rate, rent, works, refinance, documents
- Expandable details

---

## Phase 5: AI Document Vault

### Document Upload Flow
1. User uploads PDF/image
2. AI processing via Lovable AI (Gemini):
   - OCR extraction if scanned
   - Document type classification
   - Property matching based on address
   - Extract: expiry date, issue date, reference numbers, EPC rating
   - Generate confidence scores

### Review Interface
- "We think this is: [Doc Type] for [Property] (93% confidence)"
- One-click Accept or Edit
- Manual override for type and property
- Auto-rename preview before saving

### Auto-Rename Convention
`[Property_Short_Name]_[Document_Type]_[Identifier]_[Date].ext`

Examples:
- `25_Arle_Gardens_Insurance_Policy_ABC123_2026-11-30.pdf`
- `Ivy_House_Bridgwater_EPC_Rating_C_2029-04-12.pdf`

### Expiry Integration
Extracted expiry dates automatically:
- Update property compliance status
- Feed into Risk Radar
- Trigger timeline entries

---

## Phase 6: Document Inbox Zero

### Inbox View
Filter documents by status:
- Unfiled (no property assigned)
- Needs Review (pending AI confirmation)
- Low Confidence (below threshold)
- Missing Expiry Date

### Bulk Actions
- Accept all AI suggestions
- Bulk rename
- Bulk assign to property

### Dashboard Badge
"X documents need review" - clickable to inbox

---

## Phase 7: Refinance & Rate Monitoring

### Per-Property Tracking
- Current interest rate
- Fixed/variable status
- Fixed rate expiry date
- Reversion (SVR) rate
- Refinance target date
- Broker name & contact

### Automated Reminders
Surface in Portfolio Risks when:
- 6 months before fixed rate expiry
- 3 months before expiry
- On expiry date

---

## Phase 8: CSV Import

### Import Flow
1. Upload CSV file
2. Column mapping preview (drag-drop or dropdown)
3. Validation:
   - GBP currency parsing
   - Percentage handling
   - Date format conversion
   - Postcode extraction from address
4. Duplicate detection by address
5. Preview with validation errors highlighted
6. Import with progress indicator

### Field Handling
- Calculated fields (LTV, yield, ROCE) computed on display, not imported
- Store raw values only

---

## Phase 9: Activity Timeline

### Auto-Generated Entries
System creates timeline entries when:
- Property value updated
- Mortgage rate changed
- Rent changed
- Document uploaded & accepted
- Refinance completed

### Manual Entries
- Add notes for major works
- Record significant events

---

## Phase 10: Portfolio Health Scores

### Per-Property Scores (0-100)
- **Cashflow Score** - Based on net rent margin
- **Leverage Score** - Based on LTV (lower = better)
- **Risk Score** - Composite of expiry dates, EPC, compliance
- **Compliance Score** - Documents up to date

### Visualization
- Color-coded badges (🟢 70+ / 🟡 40-69 / 🔴 <40)
- Portfolio averages on dashboard
- "Weakest Properties" list

---

## Phase 11: Settings

### User Settings
- Profile (name, email)
- Password change

### Organization Settings
- Org name
- Future: invite team members

---

## Technical Notes

- **Calculations**: All computed fields (LTV, yield, ROCE, net rent) use consistent formulas across components via shared utility functions
- **Currency**: All GBP amounts formatted with `Intl.NumberFormat('en-GB')`, stored as numbers
- **Dates**: Stored as ISO, displayed as UK format (DD/MM/YYYY)
- **File Storage**: Lovable Cloud Storage for documents and photos
- **AI Integration**: Lovable AI (Gemini) for document processing via edge function

---

## Deliverables

✅ Complete database schema with RLS  
✅ Authentication (single user, org-ready)  
✅ Full dashboard with KPIs, map, charts, risks  
✅ Property CRUD with tabbed detail view  
✅ AI document vault with real processing  
✅ Document inbox with bulk actions  
✅ Refinance tracking & reminders  
✅ CSV import with validation  
✅ Activity timeline  
✅ Health scores  
✅ Dark professional UI throughout

