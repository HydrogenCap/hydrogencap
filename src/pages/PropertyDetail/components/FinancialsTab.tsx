import { PropertyPnLCard } from '@/components/financials/PropertyPnLCard';
import { PropertyFinancialSection } from '@/components/financials/PropertyFinancialSection';

export function FinancialsTab({ propertyId, currentValuation }: { propertyId: string; currentValuation: number | null }) {
  return (
    <div className="space-y-6">
      <PropertyPnLCard propertyId={propertyId} />
      <PropertyFinancialSection propertyId={propertyId} currentValuation={currentValuation} />
    </div>
  );
}
