import { Gavel } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useRentersRightsBillState } from './hooks/useRentersRightsBillState';
import { ReadinessSummaryCard } from './components/ReadinessSummaryCard';
import { BillProvisionsCard } from './components/BillProvisionsCard';
import { EvidenceLogCard } from './components/EvidenceLogCard';
import { AwaaabComplaintsCard } from './components/AwaaabComplaintsCard';
import { DecentHomesChecklistCard } from './components/DecentHomesChecklistCard';

export default function RentersRightsBill() {
  const state = useRentersRightsBillState();
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-6 w-6" />
            Renters' Rights Bill
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track compliance with the Renters' Rights Act 2025 — key obligations, registration numbers and deadline timers.
          </p>
        </div>

        <ReadinessSummaryCard />
        <BillProvisionsCard />
        <EvidenceLogCard state={state} />
        <AwaaabComplaintsCard state={state} />
        <DecentHomesChecklistCard state={state} />
      </div>
    </AppLayout>
  );
}
