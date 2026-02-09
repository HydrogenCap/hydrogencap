# HydrogenCap Codebase Audit & Repair Plan

## Audit Summary

**Codebase:** 392 files, ~83,000 lines of TypeScript/React  
**Stack:** Vite + React 18 + Supabase + TanStack Query + shadcn/ui + Tailwind  
**Database:** 75 tables, 52 migrations, 22 edge functions  
**Severity key:** 🔴 Critical • 🟡 Important • 🟢 Improvement

---

## 🔴 CRITICAL ISSUES

### 1. `getUserOrgId()` duplicated 22 times

The exact same function is copy-pasted across 22 separate hook files. Each makes an independent Supabase query to `memberships` just to get `org_id`. This means every mutation or query that needs the org fires an extra network roundtrip, and any logic change (e.g. multi-org support) requires editing 22 files.

**Files affected:**
- `useProperties.ts`, `useCompliance.ts`, `useCompanies.ts`, `useOwnership.ts`, `useOwnershipGroups.ts`, `useOwnershipLookthrough.ts`, `useActivityLog.ts`, `useBatchImport.ts`, `useBeneficialGroups.ts`, `useComplianceIntake.ts`, `useDocumentManagement.ts`, `useDocuments.ts`, `useDismissedDuplicates.ts`, `useLocalAuthorities.ts`, `useMaintenanceRequests.ts`, `useManagementCompanies.ts`, `useParties.ts`, `useRentCollection.ts`, `useRooms.ts`, `useTenancies.ts`, `useTenants.ts`, `components/inbox/DocumentUploadZone.tsx`

**Fix:** Create a shared `src/hooks/useUserOrg.ts` hook that caches the org_id via TanStack Query:

```typescript
// src/hooks/useUserOrg.ts
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUserOrg() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['user-org', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('org_id')
        .limit(1)
        .maybeSingle();
      if (error || !data) throw new Error('No organization found');
      return data.org_id;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes — org rarely changes
  });
}

// Helper for use inside mutation functions
export async function fetchUserOrgId(): Promise<string> {
  const { data, error } = await supabase
    .from('memberships')
    .select('org_id')
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error('No organization found');
  return data.org_id;
}
```

Then replace every local `getUserOrgId()` with the shared `fetchUserOrgId()` import.

---

### 2. No React Query cache configuration — excessive refetching

The `QueryClient` is created with zero configuration in `App.tsx`. TanStack Query v5 defaults to `staleTime: 0`, meaning every component mount triggers a refetch. With 7+ concurrent queries on Dashboard alone, this hammers Supabase on every navigation.

Only 1 out of ~60 queries sets `staleTime` (`useReportHistory.ts` at 30s).

**Fix:** Add sensible defaults in `App.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,        // 2 min — data stays fresh
      gcTime: 10 * 60 * 1000,           // 10 min garbage collection
      refetchOnWindowFocus: false,       // Stop refetch on tab switch
      retry: 1,                          // Single retry on failure
    },
  },
});
```

---

### 3. 40 silently swallowed errors (`catch {}`)

Forty `catch` blocks have empty bodies — no logging, no toast, no error state. Failures in compliance uploads, ownership edits, security settings, and more are completely invisible to users.

**Files with empty catch blocks include:**
- `ComplianceRegisterItem.tsx`, `ComplianceUploadDialog.tsx`, `AddNoteForm.tsx`, `SecuritySettings.tsx` (×2), `OwnershipCard.tsx`, `LegalOwnershipCard.tsx` (×2), `LegalOwnershipEditor.tsx`, `bankPresentationGenerator.ts`, and ~30 more

**Fix:** At minimum, add `console.error` and a toast notification to every catch block:

```typescript
} catch (error) {
  console.error('Failed to save:', error);
  toast({ title: 'Something went wrong', description: 'Please try again', variant: 'destructive' });
}
```

---

### 4. Dashboard has no error state handling

`Dashboard.tsx` (929 lines) destructures data from 5+ hooks but never checks `isError` or `error`. If `useProperties` fails, the page renders with `undefined` data, likely causing a white screen crash.

**Fix:** Add error handling after the loading check:

```typescript
const { data: properties, isLoading, error, isError } = useProperties();

// After loading skeleton return...
if (isError) {
  return (
    <AppLayout>
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-destructive mb-4" />
        <h2 className="text-lg font-semibold">Failed to load dashboard</h2>
        <p className="text-muted-foreground">{error?.message}</p>
        <Button onClick={() => window.location.reload()} className="mt-4">Retry</Button>
      </div>
    </AppLayout>
  );
}
```

Apply the same pattern to `Properties.tsx`, `Compliance.tsx`, `Companies.tsx`, and other data-heavy pages.

---

### 5. Duplicate Zod schema definitions — PropertyNew and PropertyEdit have their own

Both `PropertyNew.tsx` and `PropertyEdit.tsx` define their own inline `propertySchema` with Zod, despite `src/lib/schemas/property.ts` already containing a comprehensive, well-validated `propertySchema`. The inline schemas lack many of the validations in the shared schema (e.g. UK postcode regex, value range checks).

The shared schemas in `src/lib/schemas/` are only imported for `COMPLIANCE_TYPES` constants — the actual validation schemas are unused.

**Fix:** Import and use the shared schema in both pages:

```typescript
import { createPropertySchema } from '@/lib/schemas';
// ...
const form = useForm({
  resolver: zodResolver(createPropertySchema),
  // ...
});
```

Retire the inline schemas entirely.

---

## 🟡 IMPORTANT ISSUES

### 6. Zero code splitting — all 50+ pages loaded upfront

`App.tsx` eagerly imports every single page component. The initial bundle includes all 50+ routes regardless of which page the user visits. For a codebase this size, this significantly increases initial load time.

**Fix:** Use `React.lazy` + `Suspense` for all route-level pages:

```typescript
import { lazy, Suspense } from 'react';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Properties = lazy(() => import('./pages/Properties'));
const PropertyNew = lazy(() => import('./pages/PropertyNew'));
// ... all other pages

// Wrap routes in Suspense
<Suspense fallback={<LoadingSpinner />}>
  <Routes>
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    {/* ... */}
  </Routes>
</Suspense>
```

---

### 7. Oversized page components need decomposition

Several page components are excessively large and doing too much:

| File | Lines | Concern |
|------|-------|---------|
| `PropertyEdit.tsx` | 1,028 | Form + validation + geocoding + mortgage calc |
| `Dashboard.tsx` | 929 | 15 useMemo blocks, 41 imports, 5 hooks |
| `Properties.tsx` | 854 | Table + filters + bulk actions + CSV export |
| `Insights.tsx` | 824 | Multiple chart types + data transforms |
| `PropertyNew.tsx` | 723 | Mirrors PropertyEdit with duplication |
| `Settings.tsx` | 725 | 8+ settings sections in one file |

**Fix (example for Dashboard):** Extract each tab/section into its own component:

```
src/pages/Dashboard.tsx          → Orchestrator (~150 lines)
src/components/dashboard/OverviewTab.tsx
src/components/dashboard/FinanceTab.tsx
src/components/dashboard/RisksTab.tsx
src/components/dashboard/MapSection.tsx
```

For PropertyNew/PropertyEdit, create a shared `PropertyForm` component used by both.

---

### 8. `SELECT *` queries on large tables

15+ hooks use `.select('*')` which fetches every column. As the `properties` table grows (it already has 40+ columns), this wastes bandwidth and slows queries, especially for list views that only need a few fields.

**Fix:** Use explicit column selection:

```typescript
// Instead of .select('*')
.select('id, address_line, postcode, current_value_gbp, beds, asset_category, lifecycle_type')
```

Prioritise this for high-frequency queries: `useProperties`, `useContractors`, `usePropertyPassports`.

---

### 9. 47 `any` type usages

TypeScript's type safety is being bypassed in 47 places with `: any`. Notable offenders:

- `PortalDashboard.tsx`: `getPropertyFinancials(property: any)` — the portal entirely skips type checking
- `MissingInfoPropertyRow.tsx`: 5 handlers typed `(field: string, value: any)`
- `useReportGeneration.ts`: `calculatePortfolioSummary(properties: any[])`
- Multiple `catch (error: any)` blocks

**Fix:** Replace with proper types:

```typescript
// Instead of: catch (error: any) { toast(error.message) }
// Use:
catch (error) {
  const message = error instanceof Error ? error.message : 'Unknown error';
  toast({ title: 'Error', description: message, variant: 'destructive' });
}
```

For portal components, import `PropertyWithFinancials` from `useProperties`.

---

### 10. Missing search debouncing on Properties page

The properties search (`searchQuery`) fires `useMemo` recalculation on every keystroke. With 100+ properties and complex metric calculations per property, this causes noticeable UI jank.

**Fix:** Add debouncing:

```typescript
import { useDeferredValue } from 'react';

const [searchQuery, setSearchQuery] = useState('');
const deferredSearch = useDeferredValue(searchQuery);

// Use deferredSearch in the useMemo filter instead of searchQuery
```

---

### 11. No ErrorBoundary on most pages

`ErrorBoundary` is only used on Dashboard (wrapping 4 widgets). The other 50+ pages have zero error boundary coverage. A runtime error in any page component causes a full white screen crash.

**Fix:** Wrap every `<ProtectedRoute>` child with the existing ErrorBoundary, or better, add it inside `AppLayout`:

```typescript
// src/components/layout/AppLayout.tsx
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header>...</header>
        <main className="flex-1 overflow-auto p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

---

### 12. Incomplete TODO features — stub pages with no functionality

Four pages have visible TODO comments with placeholder UI and no working dialogs:

- `RentCollection.tsx:235` — `{/* TODO: Record payment dialog */}`
- `TenantDetail.tsx:224` — `{/* TODO: Create tenancy dialog */}`
- `MaintenanceRequests.tsx:220` — `{/* TODO: Create maintenance dialog */}`
- `Tenants.tsx:196` — `{/* TODO: Add tenant dialog */}`
- `PropertyMap.tsx:63` — `const hasMissingInsurance = false; // TODO: Check insurance_policies table`

These pages are accessible via the navigation — users can reach them and find non-functional buttons.

**Fix:** Either implement the dialogs or hide the routes/buttons until ready. At minimum, disable the action buttons with a tooltip: "Coming soon".

---

### 13. Excessive query invalidation

There are 243 `invalidateQueries` calls across the hooks. Many mutations invalidate broad query keys like `['properties']` which forces a full refetch of the entire properties list (with all joins) after minor changes. Some mutations invalidate 3-4 query keys at once.

**Fix:** Use targeted invalidation and optimistic updates:

```typescript
// Instead of broad invalidation after updating a single property:
queryClient.invalidateQueries({ queryKey: ['properties'] });

// Use setQueryData for optimistic updates:
onMutate: async (newData) => {
  await queryClient.cancelQueries({ queryKey: ['property', newData.id] });
  const previous = queryClient.getQueryData(['property', newData.id]);
  queryClient.setQueryData(['property', newData.id], (old) => ({ ...old, ...newData }));
  return { previous };
},
onError: (err, newData, context) => {
  queryClient.setQueryData(['property', newData.id], context.previous);
},
```

---

## 🟢 IMPROVEMENTS

### 14. `console.log` left in production code

`PropertyEdit.tsx:91` has a debug log:
```typescript
console.log('PropertyEditPage mounted', { id, isLoading, error: error?.message, hasProperty: !!property });
```

**Fix:** Remove it, or add an ESLint rule: `"no-console": ["warn", { allow: ["error", "warn"] }]`

---

### 15. Index used as React key in 3 places

Using array index as `key` can cause rendering bugs when lists are reordered or filtered:

- `ValidationPreview.tsx:65` — `key={index}`
- `FAQAccordion.tsx:21` — `key={index}`
- `Dashboard.tsx:703` — `key={index}` on chart cells

**Fix:** Use a unique identifier:
```typescript
// FAQAccordion
{faqs.map((faq) => (
  <AccordionItem key={faq.question} value={faq.question}>
```

---

### 16. Zero test coverage

The only test file is a placeholder:
```typescript
it("should pass", () => { expect(true).toBe(true); });
```

No component tests, no hook tests, no integration tests across 83,000 lines.

**Fix (priority order):**
1. Test financial calculation functions in `calculations.ts` and `mortgageCalculations.ts` — these are pure functions with clear inputs/outputs
2. Test compliance status logic in `complianceStatus.ts`
3. Test CSV parsing in `csvParser.ts` and `passportCsvParser.ts`
4. Test Zod schemas in `src/lib/schemas/`

---

### 17. No `.env.example` file

The project uses 3 environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GOOGLE_MAPS_API_KEY`) but there's no `.env.example` documenting them.

**Fix:** Create `.env.example`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
VITE_GOOGLE_MAPS_API_KEY=your-maps-key
```

---

### 18. Inconsistent date/number formatting

Some pages use the shared `formatGBP()` / `formatPercent()` / `formatDateUK()` utilities from `calculations.ts`, while others use inline formatting:

- `Insights.tsx:218`: `` `£${(value / 1000000).toFixed(1)}M` ``
- `CompanyDetail.tsx:352`: `new Date(company.ch_incorporation_date).toLocaleDateString()`
- `PortalCompliance.tsx:131`: `complianceRate.toFixed(0)`
- `Properties.tsx:712`: `` `${Number(val).toFixed(2)}%` `` instead of `formatPercent()`

**Fix:** Enforce consistent use of shared formatters everywhere. Consider adding `formatGBPCompact()` for the million/thousand shorthand cases.

---

### 19. Minimal accessibility attributes

Only 60 aria attributes across all components and just 2 in pages. Interactive elements like custom filter dropdowns, search inputs, chart sections, and modal forms lack proper `aria-label`, `aria-describedby`, and `role` attributes.

**Fix:** At minimum, add labels to search inputs, icon-only buttons, and chart sections:

```typescript
<Input
  placeholder="Search properties..."
  aria-label="Search properties"
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
/>
```

---

### 20. Supabase client has no error handling for missing env vars

`client.ts` directly reads env vars with no fallback:
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

If either is missing, the app crashes with an opaque error deep in the Supabase SDK.

**Fix:**
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.'
  );
}
```

---

### 21. Vite build has no chunking strategy

`vite.config.ts` has no `build.rollupOptions.output.manualChunks` configuration. The entire app bundles into one or two large chunks.

**Fix:** Add manual chunking:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        vendor: ['react', 'react-dom', 'react-router-dom'],
        supabase: ['@supabase/supabase-js'],
        charts: ['recharts'],
        maps: ['leaflet', 'react-leaflet'],
        pdf: ['jspdf', 'jspdf-autotable'],
        ui: ['@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-select'],
      },
    },
  },
},
```

---

### 22. Direct Supabase calls scattered in components

Several components bypass the hooks layer and call Supabase directly:

- `PassportForm.tsx` — calls `supabase.functions.invoke('estimate-construction-year')`
- `ComplianceUploadDialog.tsx` — calls `supabase.storage` directly (upload, get URL, remove)
- `DocumentUploadZone.tsx` — calls `supabase.functions.invoke` and `supabase.storage`
- `AddressAutocomplete.tsx` — calls `supabase.functions.invoke('geocode-address')`

**Fix:** Move these into dedicated hooks (e.g. `useStorageUpload`, `useEdgeFunction`) so the data layer is consistent, testable, and caches properly.

---

## Architecture Recommendations

### Short-term (next sprint)
1. Extract `getUserOrgId` into a shared utility (issue #1)
2. Configure QueryClient defaults (issue #2)
3. Add error state handling to Dashboard and Properties (issue #4)
4. Add ErrorBoundary to AppLayout (issue #11)
5. Fix empty catch blocks — add at least `console.error` (issue #3)

### Medium-term (next 2-4 weeks)
6. Implement `React.lazy` code splitting (issue #6)
7. Replace `any` types with proper types (issue #9)
8. Use shared Zod schemas in forms (issue #5)
9. Complete or hide TODO stub pages (issue #12)
10. Add Vite chunking config (issue #21)

### Long-term (ongoing)
11. Decompose oversized page components (issue #7)
12. Add unit tests for calculation/utility functions (issue #16)
13. Implement optimistic updates for key mutations (issue #13)
14. Replace `SELECT *` with explicit column selection (issue #8)
15. Improve accessibility coverage (issue #19)

---

*Audit performed on HydrogenCap `hydrogencap-main` — 9 Feb 2026*
