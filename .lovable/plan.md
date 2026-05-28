Add the existing `logError` utility from `@/lib/errorLogger` into the high-signal error-handling paths of five hooks. For every spot that currently calls `console.error` on a mutation, edge-function invoke, or storage operation, insert a `logError({ source, message, severity: 'error', error })` call immediately after the `console.error` (do not remove the `console.error`). Do not touch success paths, `console.warn` lines, or UI/toast behaviour.

### 1. useBulkPricePaidEnrich.ts
- Add `import { logError } from '@/lib/errorLogger';`
- After the `console.error` on line 42 (edge-function invoke `if (error)` branch): log with `source: 'useBulkPricePaidEnrich.enrichAll'` and `message: 'Edge function bulk-price-paid-enrich returned error'`.
- After the `console.error` on line 78 (outer `catch (err)` block): log with `source: 'useBulkPricePaidEnrich.enrichAll'` and `message: 'Unexpected error during bulk Price Paid enrichment'`.

### 2. useBulkDocScanner.ts
- Add `import { logError } from '@/lib/errorLogger';`
- After the `console.error` on line 171 (inner `catch (error: unknown)` around `process-document` edge-function invoke): log with `source: 'useBulkDocScanner.classify'` and `message: 'AI document classification via process-document failed'`.

### 3. useBulkDocumentUpload.ts
- Add `import { logError } from '@/lib/errorLogger';`
- After the `console.error` on line 196 (`catch (catError)` around `categorise-documents` edge-function invoke): log with `source: 'useBulkDocumentUpload.categorise'` and `message: 'Document categorisation via categorise-documents edge function failed'`.
- After the `console.error` on line 254 (`catch (extError)` around `process-document-v2` edge-function invoke): log with `source: 'useBulkDocumentUpload.extract'` and `message: 'Document extraction via process-document-v2 edge function failed'`.

### 4. usePortfolioBackup.ts
- Add `import { logError } from '@/lib/errorLogger';`
- After the `console.error` on line 312 (`catch (error: unknown)` around `supabase.storage...download()`): log with `source: 'usePortfolioBackup.downloadFile'` and `message: 'Storage file download failed during backup'`.

### 5. useEntityCHSync.ts
- Add `import { logError } from '@/lib/errorLogger';`
- After the `console.error` on line 45 (`catch (e)` around `createDirector.mutateAsync`): log with `source: 'useEntityCHSync.importDirector'` and `message: 'Failed to import director from Companies House'`.
- After the `console.error` on line 66 (`catch (e)` around `createShareholder.mutateAsync`): log with `source: 'useEntityCHSync.importShareholder'` and `message: 'Failed to import shareholder from Companies House'`.
- After the `console.error` on line 112 (`catch (err)` around `lookupCompany` in auto-sync): log with `source: 'useEntityCHSync.autoSync'` and `message: 'Auto-sync from Companies House failed'`.

All changes are strictly additive — no console.warn touched, no success paths modified, no new dependencies needed.