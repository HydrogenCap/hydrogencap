import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Building2, 
  Clock,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  PropertyMissingInfo,
  copyMissingToClipboard,
  FINANCE_FIELDS,
  INSURANCE_FIELDS,
} from '@/hooks/useMissingInfo';
import { MissingFieldEditor } from './MissingFieldEditor';
import { useUpdateLoan } from '@/hooks/useProperties';
import { useUpsertInsurancePolicy } from '@/hooks/useMissingInfo';
import { toast } from 'sonner';

interface Props {
  item: PropertyMissingInfo;
}

export function MissingInfoPropertyRow({ item }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [financeChanges, setFinanceChanges] = useState<Record<string, any>>({});
  const [insuranceChanges, setInsuranceChanges] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  const updateLoan = useUpdateLoan();
  const upsertInsurance = useUpsertInsurancePolicy();

  const hasChanges = Object.keys(financeChanges).length > 0 || Object.keys(insuranceChanges).length > 0;

  const statusBadge = () => {
    switch (item.status) {
      case 'complete':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Complete</Badge>;
      case 'missing_finance':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Missing Finance</Badge>;
      case 'missing_insurance':
        return <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">Missing Insurance</Badge>;
      case 'missing_both':
        return <Badge variant="destructive">Missing Both</Badge>;
    }
  };

  const handleFinanceChange = (field: string, value: any) => {
    setFinanceChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleInsuranceChange = (field: string, value: any) => {
    setInsuranceChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save finance changes
      if (Object.keys(financeChanges).length > 0) {
        const loan = item.property.loans?.[0];
        if (loan) {
          await updateLoan.mutateAsync({
            id: loan.id,
            ...financeChanges,
          });
        }
      }

      // Save insurance changes
      if (Object.keys(insuranceChanges).length > 0) {
        await upsertInsurance.mutateAsync({
          property_id: item.property.id,
          ...item.insurance,
          ...insuranceChanges,
        });
      }

      toast.success('Changes saved successfully');
      setFinanceChanges({});
      setInsuranceChanges({});
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate remaining missing fields after pending changes
  const remainingFinanceMissing = item.missingFinanceFields.filter(f => !(f in financeChanges));
  const remainingInsuranceMissing = item.missingInsuranceFields.filter(f => !(f in insuranceChanges));

  return (
    <Card className={`transition-colors ${item.renewingSoon ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="pt-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              {/* Property Info */}
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <Link 
                    to={`/properties/${item.property.id}`}
                    className="font-medium hover:underline text-foreground block truncate"
                    onClick={e => e.stopPropagation()}
                  >
                    {item.property.address_line}
                  </Link>
                  {item.property.postcode && (
                    <span className="text-sm text-muted-foreground">{item.property.postcode}</span>
                  )}
                </div>
              </div>

              {/* Status & Badges */}
              <div className="flex items-center gap-2 shrink-0">
                {item.renewingSoon && (
                  <Badge variant="outline" className="border-amber-500 text-amber-600">
                    <Clock className="h-3 w-3 mr-1" />
                    Renewal Soon
                  </Badge>
                )}
                {statusBadge()}
                <Badge variant="outline">{item.totalMissing} missing</Badge>
                {isOpen ? (
                  <ChevronUp className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-6 py-4 space-y-6">
            {/* Missing Finance Fields */}
            {item.missingFinanceFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                  Missing Finance ({remainingFinanceMissing.length} remaining)
                  {Object.keys(financeChanges).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(financeChanges).length} filled
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.missingFinanceFields.map(fieldKey => {
                    const fieldDef = FINANCE_FIELDS.find(f => f.key === fieldKey);
                    if (!fieldDef) return null;
                    const isFilled = fieldKey in financeChanges;
                    return (
                      <div key={fieldKey} className={isFilled ? 'opacity-50' : ''}>
                        <MissingFieldEditor
                          field={fieldDef}
                          value={financeChanges[fieldKey]}
                          onChange={val => handleFinanceChange(fieldKey, val)}
                          isFilled={isFilled}
                        />
                        {isFilled && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 absolute top-2 right-2" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Missing Insurance Fields */}
            {item.missingInsuranceFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-purple-600 mb-3 flex items-center gap-2">
                  Missing Insurance ({remainingInsuranceMissing.length} remaining)
                  {Object.keys(insuranceChanges).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(insuranceChanges).length} filled
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.missingInsuranceFields.map(fieldKey => {
                    const fieldDef = INSURANCE_FIELDS.find(f => f.key === fieldKey);
                    if (!fieldDef) return null;
                    const isFilled = fieldKey in insuranceChanges;
                    return (
                      <div key={fieldKey} className={isFilled ? 'opacity-50' : ''}>
                        <MissingFieldEditor
                          field={fieldDef}
                          value={insuranceChanges[fieldKey]}
                          onChange={val => handleInsuranceChange(fieldKey, val)}
                          isFilled={isFilled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyMissingToClipboard(item)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Request
              </Button>

              <Button
                onClick={handleSave}
                disabled={!hasChanges || isSaving}
                size="sm"
              >
                <Save className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
