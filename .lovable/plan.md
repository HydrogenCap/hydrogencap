## Goal

Wire the existing `logError()` util into high-signal failure paths of four hooks so mutation / edge-function / storage failures are persisted to `errors_log`. Strictly additive — existing `console.error`, toasts, return values, and control flow stay untouched.

## Scope (4 files, 6 edits)

Import to add at the top of each file (matching `useComplianceIntake.ts` style):

```ts
import { logError } from '@/lib/errorLogger';
```

### 1. `src/hooks/useSignedUrl.ts`

Two true `catch` blocks, both wrapping Supabase storage operations.

- Line 67 catch in `fetchSignedUrl` (storage `createSignedUrl`):
  ```ts
  logError({ source: 'useSignedUrl.fetchSignedUrl', message: 'Failed to generate signed URL', severity: 'error', error: err });
  ```
- Line 123 catch in `useDownloadFile.download` (storage `createSignedUrl` + fetch):
  ```ts
  logError({ source: 'useSignedUrl.download', message: 'Failed to download file from storage', severity: 'error', error: err });
  ```

Line 59 (`if (signError)`) is an error branch, not a `catch`, so per the instructions it is left alone.

### 2. `src/hooks/useMaintenanceRequests.ts`

- Line 210, the `.catch()` handler on the fire-and-forget `createNotification(...)` mutation:
  ```ts
  .catch((err) => {
    console.error('Failed to create maintenance notification:', err);
    logError({ source: 'useMaintenanceRequests.createNotification', message: 'Failed to create maintenance notification', severity: 'error', error: err });
  });
  ```

### 3. `src/hooks/useTeamManagement.ts`

- Line 198 is an `if (fnError)` branch after `supabase.functions.invoke('send-team-invite', ...)`, not a `catch` block. Per the strict "catch blocks only" rule it would be skipped, but it is the only error-handling branch for an edge-function invoke in this hook and matches the spirit of "high-signal edge-function failures".
  
  **Proposed:** add `logError` here as well, additively:
  ```ts
  if (fnError) {
    console.error('Email send failed:', fnError);
    logError({ source: 'useTeamManagement.sendTeamInvite', message: 'send-team-invite edge function failed', severity: 'error', error: fnError });
    // Don't throw — invite is created, they can copy the link manually
  }
  ```
  
  If you want me to honour the catch-block rule strictly, this file gets only the `logError` import and no call site — let me know in feedback and I'll drop it.

### 4. `src/hooks/useRentCollection.ts`

- Line 1002 catch around `supabase.functions.invoke('send-rent-reminder', ...)`:
  ```ts
  } catch (err) {
    console.error('Failed to send reminder:', err);
    logError({ source: 'useRentCollection.sendRentReminder', message: 'send-rent-reminder edge function failed', severity: 'error', error: err });
    results.failed++;
  }
  ```

## Guarantees

- No `console.error` removed; no `console.warn` touched.
- No success-path code, return values, toasts, query invalidations, or UI behaviour modified.
- No new dependencies; `logError` already exists and is side-effect-safe (never throws).
- Diff is purely additive: one import + one new line per edit site.

## Out of scope

- The `if (signError)` branch in `useSignedUrl.ts` (not a catch block, low signal — fallback already swallows it).
- Any other hooks or files.
- Refactoring shared error-handling utilities.
