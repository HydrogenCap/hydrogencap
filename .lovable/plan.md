## Cleanup Plan

### 1. Remove dead dependencies from `package.json`
Verified zero references in `src/` and `supabase/functions/`:
- `lodash`
- `axios`
- `framer-motion`
- `papaparse`

Keep `moment`, `uuid`, `xlsx` (still used).

### 2. Delete dead components
Verified zero importers anywhere in `src/` (the only matches were each file defining its own symbol):
- `src/components/ownership/ShareholdingEditor.tsx`
- `src/components/companies/ShareholdingEditor.tsx`
- `src/components/compliance/QuickRenewalDialog.tsx`
- `src/components/ownership/DerivedBeneficialOwnershipCard.tsx`

All four are unreferenced and will be deleted.

### 3. Verify
- `bun install` to regenerate `bun.lock`
- `bun run lint`
- `bun run typecheck`
- `bun run build`

No other files touched.