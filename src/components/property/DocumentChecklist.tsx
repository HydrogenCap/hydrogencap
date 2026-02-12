import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { useAllCompliance } from '@/hooks/useCompliance';

interface DocumentChecklistProps {
  propertyId: string;
  isHmo?: boolean;
  hasGas?: boolean;
  tenure?: string | null;
}

interface ChecklistItem {
  label: string;
  complianceType: string;
  required: boolean;
  condition?: boolean;
}

function getChecklist(isHmo: boolean, hasGas: boolean, tenure: string | null): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { label: 'EPC Certificate', complianceType: 'epc', required: true },
    { label: 'EICR (Electrical)', complianceType: 'eicr', required: true },
    { label: 'Gas Safety Certificate', complianceType: 'gas_safety', required: hasGas !== false },
    { label: 'Legionella Risk Assessment', complianceType: 'legionella', required: true },
    { label: 'Fire Alarm Certificate', complianceType: 'fire_alarm', required: true },
    { label: 'Emergency Lighting', complianceType: 'emergency_lighting', required: isHmo },
    { label: 'HMO Licence', complianceType: 'hmo_licence', required: isHmo },
    { label: 'Buildings Insurance', complianceType: 'buildings_insurance', required: true },
    { label: 'Landlord Insurance', complianceType: 'landlord_insurance', required: true },
  ];

  if (tenure === 'Leasehold') {
    items.push({ label: 'Lease Document', complianceType: 'lease', required: true });
  }

  return items.filter(item => item.required);
}

function getComplianceStatus(item: any): 'valid' | 'expired' | 'expiring_soon' | 'missing' {
  if (!item) return 'missing';
  if (!item.expiry_date) return 'valid';
  const expiry = new Date(item.expiry_date);
  const now = new Date();
  const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  if (expiry < now) return 'expired';
  if (expiry < thirtyDays) return 'expiring_soon';
  return 'valid';
}

export function DocumentChecklist({ propertyId, isHmo = false, hasGas = true, tenure }: DocumentChecklistProps) {
  const { data: complianceItems } = useAllCompliance();

  const checklist = useMemo(() => {
    const items = getChecklist(isHmo, hasGas, tenure);
    const propertyCompliance = complianceItems?.filter(c => c.property_id === propertyId) || [];

    return items.map(item => {
      const match = propertyCompliance.find(c => c.compliance_type === item.complianceType);
      const status = getComplianceStatus(match);
      return { ...item, status, complianceItem: match };
    });
  }, [complianceItems, propertyId, isHmo, hasGas, tenure]);

  const validCount = checklist.filter(i => i.status === 'valid').length;
  const total = checklist.length;
  const pct = total > 0 ? Math.round((validCount / total) * 100) : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileCheck className="h-5 w-5" />
            Document Checklist
          </CardTitle>
          <Badge variant={pct === 100 ? 'default' : pct >= 70 ? 'secondary' : 'destructive'}>
            {validCount}/{total} ({pct}%)
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {checklist.map((item) => (
            <div key={item.complianceType} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                {item.status === 'valid' ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : item.status === 'expiring_soon' ? (
                  <AlertTriangle className="h-4 w-4 text-warning" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm">{item.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">
                {item.status === 'valid' && item.complianceItem?.expiry_date
                  ? `Expires ${new Date(item.complianceItem.expiry_date).toLocaleDateString('en-GB')}`
                  : item.status === 'expired' ? 'Expired'
                  : item.status === 'expiring_soon' ? 'Expiring soon'
                  : 'Missing'}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
