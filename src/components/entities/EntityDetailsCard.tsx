import { Card, CardContent } from '@/components/ui/card';
import type { LegalEntity } from '@/hooks/useLegalEntities';
import { formatDateUK } from '@/lib/calculations';


interface EntityDetailsCardProps {
  entity: LegalEntity;
}

export function EntityDetailsCard({ entity }: EntityDetailsCardProps) {
  const hasDetails =
    entity.registered_address ||
    entity.corporation_tax_ref ||
    entity.vat_number ||
    entity.incorporation_date ||
    entity.notes ||
    entity.company_number;

  if (!hasDetails) return null;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {entity.incorporation_date && (
            <div>
              <span className="text-muted-foreground">Incorporation Date</span>
              <p className="font-medium">{formatDateUK(entity.incorporation_date)}</p>
            </div>
          )}
          {entity.registered_address && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Registered Address</span>
              <p className="font-medium">{entity.registered_address}</p>
            </div>
          )}
          {entity.corporation_tax_ref && (
            <div>
              <span className="text-muted-foreground">Corporation Tax Ref</span>
              <p className="font-medium font-mono">{entity.corporation_tax_ref}</p>
            </div>
          )}
          {entity.vat_registered && (
            <div>
              <span className="text-muted-foreground">VAT Number</span>
              <p className="font-medium font-mono">{entity.vat_number || 'Registered (no number)'}</p>
            </div>
          )}
          {entity.company_number && (
            <div>
              <span className="text-muted-foreground">Companies House</span>
              <p>
                <a
                  href={`https://find-and-update.company-information.service.gov.uk/company/${entity.company_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  View on Companies House ↗
                </a>
              </p>
            </div>
          )}
          {entity.ch_last_synced_at && (
            <div>
              <span className="text-muted-foreground">Last CH Sync</span>
              <p className="font-medium">{formatDateUK(entity.ch_last_synced_at)}</p>
            </div>
          )}
          {entity.notes && (
            <div className="col-span-full">
              <span className="text-muted-foreground">Notes</span>
              <p className="font-medium">{entity.notes}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
