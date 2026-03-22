import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, FileCheck } from 'lucide-react';
import { useAllCompliance } from '@/hooks/useCompliance';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DocumentChecklistProps {
  propertyId: string;
  isHmo?: boolean;
  hasGas?: boolean;
  tenure?: string | null;
}

interface ChecklistItem {
  label: string;
  complianceTypes: string[]; // DB compliance_type values to match against
  source: 'compliance' | 'insurance';
  required: boolean;
  insuranceField?: string;
}

interface ComplianceChecklistRecord {
  property_id: string;
  compliance_type: string;
  expiry_date: string | null;
}

interface InsurancePolicyRecord {
  renewal_date: string | null;
  status: string | null;
}

function getChecklist(isHmo: boolean, hasGas: boolean, tenure: string | null): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { label: 'EPC Certificate', complianceTypes: ['EPC', 'epc'], source: 'compliance', required: true },
    { label: 'EICR (Electrical)', complianceTypes: ['Electrical Safety Certificate (EICR)', 'eicr'], source: 'compliance', required: true },
    { label: 'Gas Safety Certificate', complianceTypes: ['Gas Safety Certificate (CP12)', 'gas_safety'], source: 'compliance', required: hasGas !== false },
    { label: 'Legionella Risk Assessment', complianceTypes: ['Legionella Risk Assessment', 'legionella'], source: 'compliance', required: true },
    { label: 'Fire Alarm Certificate', complianceTypes: ['Fire Alarm Certificate', 'fire_alarm'], source: 'compliance', required: true },
    { label: 'Emergency Lighting', complianceTypes: ['Emergency Lighting Certificate', 'emergency_lighting'], source: 'compliance', required: isHmo },
    { label: 'HMO Licence', complianceTypes: ['HMO Licence', 'hmo_licence'], source: 'compliance', required: isHmo },
    { label: 'Buildings Insurance', complianceTypes: ['Buildings Insurance Schedule', 'buildings_insurance'], source: 'insurance', required: true },
    { label: 'Landlord Insurance', complianceTypes: ['landlord_insurance'], source: 'insurance', required: true },
  ];

  if (tenure === 'Leasehold') {
    items.push({ label: 'Lease Document', complianceTypes: ['lease'], source: 'compliance', required: true });
  }

  return items.filter(item => item.required);
}

type ItemStatus = 'valid' | 'expired' | 'expiring_soon' | 'missing';

function getComplianceStatus(item: ComplianceChecklistRecord | undefined): ItemStatus {
  if (!item) return 'missing';
  if (!item.expiry_date) return 'valid';
  const expiry = new Date(item.expiry_date);
  const now = new Date();
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (expiry < now) return 'expired';
  if (expiry < sixtyDays) return 'expiring_soon';
  return 'valid';
}

function getInsuranceStatus(policy: InsurancePolicyRecord | null): ItemStatus {
  if (!policy) return 'missing';
  if (policy.status === 'expired') return 'expired';
  if (!policy.renewal_date) return 'valid';
  const renewal = new Date(policy.renewal_date);
  const now = new Date();
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  if (renewal < now) return 'expired';
  if (renewal < sixtyDays) return 'expiring_soon';
  return 'valid';
}

export function DocumentChecklist({ propertyId, isHmo = false, hasGas = true, tenure }: DocumentChecklistProps) {
  const { data: complianceData } = useAllCompliance();
  const complianceItems = complianceData?.items as ComplianceChecklistRecord[] | undefined;
  const { data: insurancePolicy } = useQuery<InsurancePolicyRecord | null>({
    queryKey: ['insurance-policy', propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from('insurance_policies')
        .select('*')
        .eq('property_id', propertyId)
        .maybeSingle();
      return data;
    },
    enabled: !!propertyId,
  });

  const checklist = useMemo(() => {
    const items = getChecklist(isHmo, hasGas, tenure);
    const propertyCompliance = complianceItems?.filter(c => c.property_id === propertyId) || [];

    return items.map(item => {
      let status: ItemStatus = 'missing';
      let expiryDate: string | null = null;

      if (item.source === 'insurance') {
        if (insurancePolicy) {
          status = getInsuranceStatus(insurancePolicy);
          expiryDate = insurancePolicy.renewal_date;
        }
      } else {
        const match = propertyCompliance.find(c =>
          item.complianceTypes.some(t => 
            c.compliance_type.toLowerCase() === t.toLowerCase()
          )
        );
        status = getComplianceStatus(match);
        expiryDate = match?.expiry_date || null;
      }

      return { ...item, status, expiryDate };
    });
  }, [complianceItems, insurancePolicy, propertyId, isHmo, hasGas, tenure]);

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
          {checklist.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-1">
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
                {item.status === 'valid' && item.expiryDate
                  ? `Expires ${new Date(item.expiryDate).toLocaleDateString('en-GB')}`
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
