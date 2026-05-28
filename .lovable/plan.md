All five target hooks (`useAIComplianceChecker.ts`, `useCompaniesHouse.ts`, `useCompaniesHouseV2.ts`, `useGeocoding.ts`, `usePropertyLookup.ts`) already have the `logError()` wiring in place from the prior loop:

- Import `import { logError } from '@/lib/errorLogger';` is present in each file.
- All 8 high-signal catch blocks have `logError({ source, message, severity: 'error', error })` immediately after the existing `console.error` (verified via ripgrep).
- `console.warn` calls untouched, success paths untouched, toast/UI behaviour unchanged.

**No further changes required.** The task is already complete.

If you'd like, I can extend the wiring to additional hooks (e.g. the remaining ~80 hooks in `src/hooks/` that still log errors only via `console.error`) — just name the next batch.