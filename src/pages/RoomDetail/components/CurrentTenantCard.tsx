import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TENANCY_TYPES } from '@/hooks/useTenancyAgreements';
import { Row } from './Row';
import { fmtRent } from '../utils/format';
import type { RoomDetailState } from '../hooks/useRoomDetailState';

export function CurrentTenantCard({ state }: { state: RoomDetailState }) {
  const { activeAgreement, setShowCreateAgreement } = state;
  return (
    <Card>
      <CardHeader><CardTitle>Current Tenant</CardTitle></CardHeader>
      <CardContent>
        {activeAgreement ? (
          <div className="space-y-2 text-sm">
            <Row label="Tenant" value={<Link to={`/tenants-v2/${activeAgreement.tenant_id}`} className="text-primary underline font-medium">{activeAgreement.tenant_name || '—'}</Link>} />
            <Row label="Type" value={<Badge variant="secondary">{TENANCY_TYPES.find(t => t.value === activeAgreement.tenancy_type)?.label || activeAgreement.tenancy_type}</Badge>} />
            <Row label="Start Date" value={format(new Date(activeAgreement.start_date), 'dd/MM/yyyy')} />
            <Row label="Rent PCM" value={fmtRent(activeAgreement.rent_amount_pcm)} />
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-muted-foreground mb-3">No current tenant</p>
            <Button onClick={() => setShowCreateAgreement(true)}>
              <Plus className="h-4 w-4 mr-2" /> Assign Tenant
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
