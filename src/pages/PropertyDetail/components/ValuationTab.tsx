import { Button } from '@/components/ui/button';
import { ValuationHistoryChart } from '@/components/valuations/ValuationHistoryChart';
import { ComparableEvidenceLog } from '@/components/valuations/ComparableEvidenceLog';
import { RevaluationTrigger } from '@/components/valuations/RevaluationTrigger';

interface Props {
  propertyId: string;
  purchasePrice: number | null;
  purchaseDate: string | null;
  onRecord: () => void;
}

export function ValuationTab({ propertyId, purchasePrice, purchaseDate, onRecord }: Props) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={onRecord}>Record Valuation</Button>
      </div>
      <ValuationHistoryChart propertyId={propertyId} purchasePrice={purchasePrice} purchaseDate={purchaseDate} />
      <ComparableEvidenceLog propertyId={propertyId} />
      <RevaluationTrigger propertyId={propertyId} />
    </div>
  );
}
