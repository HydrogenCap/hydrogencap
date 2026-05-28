Wire `logError()` from `src/lib/errorLogger.ts` into high-signal catch blocks across 5 hooks. All changes are strictly additive — keep existing `console.error` and `console.warn`, do not modify success paths or UI/toast behaviour.

Pattern for every spot:
- Add `import { logError } from '@/lib/errorLogger';` at the top of the file (only once per file).
- Immediately after each existing `console.error(...)` in a catch block, insert:
  ```ts
  logError({ source: '<hookName>.<operation>', message: '<short human description>', severity: 'error', error: err });
  ```

### Spots per hook (8 total)

1. **`useAIComplianceChecker.ts`** — 1 spot
   - `onError` callback of `analyzeCompliance` useMutation (line ~76). Edge-function `ai-compliance-checker` invocation failure.
   - Source: `'useAIComplianceChecker.analyzeCompliance'`
   - Message: `'AI compliance checker edge function failed'`

2. **`useCompaniesHouse.ts`** — 2 spots
   - `catch (err)` in `searchCompanies` (line ~78). Edge-function `companies-house-lookup` search failure.
     - Source: `'useCompaniesHouse.searchCompanies'`
     - Message: `'Companies House search edge function failed'`
   - `catch (err)` in `lookupCompany` (line ~119). Edge-function `companies-house-lookup` lookup failure.
     - Source: `'useCompaniesHouse.lookupCompany'`
     - Message: `'Companies House company lookup edge function failed'`

3. **`useCompaniesHouseV2.ts`** — 1 spot
   - `catch (err)` in `searchCompanies` (line ~108). Edge-function `companies-house` search failure.
     - Source: `'useCompaniesHouseV2.searchCompanies'`
     - Message: `'Companies House V2 search edge function failed'`
   - Note: `fetchProfile`, `fetchOfficers`, `fetchFilingHistory` have no try/catch — they throw directly, so no `console.error` to augment.

4. **`useGeocoding.ts`** — 3 spots
   - `catch (err)` in `geocodeAddress` (line ~65). Edge-function `geocode-address` invocation failure.
     - Source: `'useGeocoding.geocodeAddress'`
     - Message: `'Geocode address edge function failed'`
   - `catch (err)` inside backfill per-property loop (line ~245). Individual `geocodeProperty` failure.
     - Source: `'useGeocoding.backfillPerProperty'`
     - Message: `'Geocode property failed during backfill'`
   - `catch (err)` in `startBackfill` (line ~293). Overall backfill operation failure.
     - Source: `'useGeocoding.startBackfill'`
     - Message: `'Property geocode backfill failed'`

5. **`usePropertyLookup.ts`** — 1 spot
   - `catch (err)` in `lookupProperty` (line ~91). Edge-function `property-lookup` invocation failure.
     - Source: `'usePropertyLookup.lookupProperty'`
     - Message: `'Property lookup edge function failed'`

### Technical details
- Import path: `import { logError } from '@/lib/errorLogger';` (same pattern as `useComplianceIntake.ts`).
- `logError` is `async` but called without `await` in catch blocks so it never blocks the calling flow.
- No new dependencies. No changes to `console.warn`, success paths, toast messages, or return values.