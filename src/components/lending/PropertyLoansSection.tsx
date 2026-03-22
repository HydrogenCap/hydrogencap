import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus } from 'lucide-react';
import { LoanFacilityCard } from './LoanFacilityCard';
import { LoanFacilityModal } from './LoanFacilityModal';
import {
  useLoanFacilitiesByProperty,
  useLoanAlerts,
  useUpdateLoanFacility,
  fmtGBP,
  type LoanFacilityWithDetails,
} from '@/hooks/useLoanFacilities';
import { useToast } from '@/hooks/use-toast';

interface Props {
  propertyId: string;
  entityId: string;
  entities: { id: string; entity_name: string }[];
  propertyValuation?: number | null;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export function PropertyLoansSection({ propertyId, entityId, entities, propertyValuation }: Props) {
  const { data: facilities = [], isLoading } = useLoanFacilitiesByProperty(propertyId);
  const { data: alerts = [] } = useLoanAlerts();
  const updateFacility = useUpdateLoanFacility();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<LoanFacilityWithDetails | null>(null);

  const activeFacilities = facilities.filter(f => f.status === 'active');
  const totalDebt = activeFacilities.reduce((s, f) => s + f.current_balance, 0);
  const weightedRate = activeFacilities.length > 0
    ? activeFacilities.reduce((s, f) => s + f.interest_rate * f.current_balance, 0) / totalDebt
    : 0;

  const handleRedeem = async (id: string) => {
    try {
      await updateFacility.mutateAsync({ id, status: 'redeemed' });
      toast({ title: 'Loan marked as redeemed' });
    } catch (err: unknown) {
      toast({ title: 'Error', description: getErrorMessage(err), variant: 'destructive' });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>Mortgage & Lending</CardTitle>
            {activeFacilities.length > 0 && (
              <>
                <Badge variant="secondary">{fmtGBP(totalDebt)} total debt</Badge>
                <Badge variant="outline">{weightedRate.toFixed(2)}% avg rate</Badge>
              </>
            )}
          </div>
          <Button size="sm" onClick={() => { setEditing(null); setShowModal(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Add Loan Facility
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-6">Loading...</p>
          ) : facilities.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No loan facilities recorded for this property.</p>
          ) : (
            <div className="space-y-4">
              {facilities.map(f => (
                <LoanFacilityCard
                  key={f.id}
                  facility={f}
                  alerts={alerts}
                  onEdit={fac => { setEditing(fac); setShowModal(true); }}
                  onRedeem={handleRedeem}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <LoanFacilityModal
        open={showModal}
        onOpenChange={setShowModal}
        propertyId={propertyId}
        entities={entities}
        defaultEntityId={entityId}
        editingFacility={editing}
        propertyValuation={propertyValuation}
      />
    </>
  );
}
