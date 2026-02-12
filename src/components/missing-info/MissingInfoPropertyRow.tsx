import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Building2, 
  Clock,
  Save,
  AlertTriangle,
  Calculator,
  Edit2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  PropertyMissingInfo,
  copyMissingToClipboard,
  PROPERTY_CORE_FIELDS,
  INCOME_FIELDS,
  FINANCE_FIELDS,
  INSURANCE_FIELDS,
  PASSPORT_FIELDS,
  CRITICAL_PASSPORT_FIELDS,
  TERM_YEARS_FIELD,
} from '@/hooks/useMissingInfo';
import { MissingFieldEditor } from './MissingFieldEditor';
import { useUpdateLoan, useUpdateProperty, useUpsertIncome } from '@/hooks/useProperties';
import { useUpsertInsurancePolicy } from '@/hooks/useMissingInfo';
import { useUpsertPassport } from '@/hooks/usePropertyPassport';
import { toast } from 'sonner';

interface Props {
  item: PropertyMissingInfo;
}

export function MissingInfoPropertyRow({ item }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [propertyChanges, setPropertyChanges] = useState<Record<string, any>>({});
  const [incomeChanges, setIncomeChanges] = useState<Record<string, any>>({});
  const [financeChanges, setFinanceChanges] = useState<Record<string, any>>({});
  const [insuranceChanges, setInsuranceChanges] = useState<Record<string, any>>({});
  const [passportChanges, setPassportChanges] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPaymentOverride, setShowPaymentOverride] = useState(false);
  const [paymentOverrideValue, setPaymentOverrideValue] = useState<number | undefined>();

  const updateProperty = useUpdateProperty();
  const updateLoan = useUpdateLoan();
  const upsertIncome = useUpsertIncome();
  const upsertInsurance = useUpsertInsurancePolicy();
  const upsertPassport = useUpsertPassport();

  const hasChanges = 
    Object.keys(propertyChanges).length > 0 ||
    Object.keys(incomeChanges).length > 0 ||
    Object.keys(financeChanges).length > 0 || 
    Object.keys(insuranceChanges).length > 0 ||
    Object.keys(passportChanges).length > 0 ||
    paymentOverrideValue !== undefined;

  const statusBadge = () => {
    switch (item.status) {
      case 'complete':
        return <Badge variant="secondary" className="bg-success/10 text-success">Complete</Badge>;
      case 'missing_property':
        return <Badge variant="secondary" className="bg-green-500/10 text-green-600">Missing Property</Badge>;
      case 'missing_income':
        return <Badge variant="secondary" className="bg-orange-500/10 text-orange-600">Missing Income</Badge>;
      case 'missing_finance':
        return <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">Missing Finance</Badge>;
      case 'missing_insurance':
        return <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">Missing Insurance</Badge>;
      case 'missing_passport':
        return <Badge variant="secondary" className="bg-blue-500/10 text-blue-600">Missing Passport</Badge>;
      case 'missing_multiple':
        return <Badge variant="destructive">Missing Multiple</Badge>;
    }
  };

  const handlePropertyChange = (field: string, value: string | number | boolean | null) => {
    setPropertyChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleIncomeChange = (field: string, value: string | number | boolean | null) => {
    setIncomeChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleFinanceChange = (field: string, value: string | number | boolean | null) => {
    setFinanceChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleInsuranceChange = (field: string, value: string | number | boolean | null) => {
    setInsuranceChanges(prev => ({ ...prev, [field]: value }));
  };

  const handlePassportChange = (field: string, value: string | number | boolean | null) => {
    setPassportChanges(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveComputedPayment = async () => {
    if (!item.monthlyPayment.amount) return;
    
    const loan = item.property.loans?.[0];
    if (!loan) return;

    setIsSaving(true);
    try {
      await updateLoan.mutateAsync({
        id: loan.id,
        mortgage_payment_gbp: item.monthlyPayment.amount,
        payment_auto_calculated_gbp: item.monthlyPayment.amount,
        payment_source: 'auto',
      });
      toast.success('Computed payment saved');
    } catch (error) {
      toast.error('Failed to save payment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save property core changes
      if (Object.keys(propertyChanges).length > 0) {
        await updateProperty.mutateAsync({
          id: item.property.id,
          ...propertyChanges,
        });
      }

      // Save income changes
      if (Object.keys(incomeChanges).length > 0) {
        const currentYear = new Date().getFullYear();
        await upsertIncome.mutateAsync({
          property_id: item.property.id,
          year: currentYear,
          ...incomeChanges,
        });
      }

      // Save finance changes
      const loan = item.property.loans?.[0];
      const hasFinanceChanges = Object.keys(financeChanges).length > 0;
      const hasPaymentOverride = paymentOverrideValue !== undefined;

      if ((hasFinanceChanges || hasPaymentOverride) && loan) {
        const loanUpdate: Record<string, any> = { ...financeChanges };
        
        if (hasPaymentOverride) {
          loanUpdate.mortgage_payment_gbp = paymentOverrideValue;
          loanUpdate.payment_override_gbp = paymentOverrideValue;
          loanUpdate.payment_source = 'manual';
        }

        await updateLoan.mutateAsync({
          id: loan.id,
          ...loanUpdate,
        });
      }

      // Save insurance changes
      if (Object.keys(insuranceChanges).length > 0) {
        await upsertInsurance.mutateAsync({
          property_id: item.property.id,
          ...item.insurance,
          ...insuranceChanges,
        });
      }

      // Save passport changes
      if (Object.keys(passportChanges).length > 0) {
        await upsertPassport.mutateAsync({
          property_id: item.property.id,
          ...passportChanges,
        });
      }

      toast.success('Changes saved successfully');
      setPropertyChanges({});
      setIncomeChanges({});
      setFinanceChanges({});
      setInsuranceChanges({});
      setPassportChanges({});
      setPaymentOverrideValue(undefined);
      setShowPaymentOverride(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate remaining missing fields after pending changes
  const remainingPropertyCoreMissing = item.missingPropertyCoreFields.filter(f => !(f in propertyChanges));
  const remainingIncomeMissing = item.missingIncomeFields.filter(f => !(f in incomeChanges));
  const remainingFinanceMissing = item.missingFinanceFields.filter(f => !(f in financeChanges));
  const remainingInsuranceMissing = item.missingInsuranceFields.filter(f => !(f in insuranceChanges));
  const remainingPassportMissing = item.missingPassportFields.filter(f => !(f in passportChanges));

  // Check if there are critical passport fields missing
  const hasCriticalMissing = item.missingCriticalPassportFields.length > 0;

  // Get the appropriate field definition (including term_years)
  const getFinanceFieldDefinition = (fieldKey: string) => {
    if (fieldKey === 'term_years') return TERM_YEARS_FIELD;
    return FINANCE_FIELDS.find(f => f.key === fieldKey);
  };

  return (
    <Card className={`transition-colors ${item.renewingSoon || item.hmoLicenceExpiringSoon ? 'border-amber-500/50 bg-amber-500/5' : ''}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="pt-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex flex-col gap-3">
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
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {item.renewingSoon && (
                    <Badge variant="outline" className="border-amber-500 text-amber-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Insurance Renewal
                    </Badge>
                  )}
                  {item.hmoLicenceExpiringSoon && (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      HMO Expiring
                    </Badge>
                  )}
                  {hasCriticalMissing && (
                    <Badge variant="outline" className="border-red-500 text-red-600">
                      Critical Data Missing
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

              {/* Completeness Progress Bar */}
              <div className="flex items-center gap-3">
                <Progress 
                  value={item.completenessPercent} 
                  className="h-2 flex-1"
                />
                <span className={`text-sm font-medium min-w-[3.5rem] text-right ${
                  item.completenessPercent === 100 
                    ? 'text-success' 
                    : item.completenessPercent >= 75 
                      ? 'text-foreground' 
                      : item.completenessPercent >= 50 
                        ? 'text-amber-600' 
                        : 'text-destructive'
                }`}>
                  {item.completenessPercent}%
                </span>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-6 py-4 space-y-6">
            {/* Missing Property Core Fields */}
            {item.missingPropertyCoreFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                  Missing Property Details ({remainingPropertyCoreMissing.length} remaining)
                  {Object.keys(propertyChanges).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(propertyChanges).length} filled
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.missingPropertyCoreFields.map(fieldKey => {
                    const fieldDef = PROPERTY_CORE_FIELDS.find(f => f.key === fieldKey);
                    if (!fieldDef) return null;
                    const isFilled = fieldKey in propertyChanges;
                    return (
                      <div key={fieldKey} className={isFilled ? 'opacity-50' : ''}>
                        <MissingFieldEditor
                          field={fieldDef}
                          value={propertyChanges[fieldKey]}
                          onChange={val => handlePropertyChange(fieldKey, val)}
                          isFilled={isFilled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Missing Income Fields */}
            {item.missingIncomeFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-orange-600 mb-3 flex items-center gap-2">
                  Missing Income ({remainingIncomeMissing.length} remaining)
                  {Object.keys(incomeChanges).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(incomeChanges).length} filled
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.missingIncomeFields.map(fieldKey => {
                    const fieldDef = INCOME_FIELDS.find(f => f.key === fieldKey);
                    if (!fieldDef) return null;
                    const isFilled = fieldKey in incomeChanges;
                    return (
                      <div key={fieldKey} className={isFilled ? 'opacity-50' : ''}>
                        <MissingFieldEditor
                          field={fieldDef}
                          value={incomeChanges[fieldKey]}
                          onChange={val => handleIncomeChange(fieldKey, val)}
                          isFilled={isFilled}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                    const fieldDef = getFinanceFieldDefinition(fieldKey);
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
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Computed Monthly Payment Display */}
            {item.property.loans?.[0] && (
              <div className="bg-muted/50 rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Calculator className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Monthly Payment (auto-calculated)</span>
                </div>
                
                {item.monthlyPayment.canCalculate ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl font-semibold text-foreground">
                        £{item.monthlyPayment.amount?.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {item.monthlyPayment.source === 'override' ? 'Manual override' : 'Calculated'}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={handleSaveComputedPayment}
                        disabled={isSaving || item.monthlyPayment.source === 'override'}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save computed value
                      </Button>
                      
                      <div className="flex items-center gap-2">
                        <Switch
                          id="override-payment"
                          checked={showPaymentOverride}
                          onCheckedChange={setShowPaymentOverride}
                        />
                        <Label htmlFor="override-payment" className="text-xs text-muted-foreground">
                          Override
                        </Label>
                      </div>
                    </div>

                    {showPaymentOverride && (
                      <div className="flex items-center gap-2 mt-2">
                        <Edit2 className="h-4 w-4 text-muted-foreground" />
                        <div className="relative flex-1 max-w-xs">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Enter manual payment"
                            value={paymentOverrideValue ?? ''}
                            onChange={e => setPaymentOverrideValue(e.target.value ? parseFloat(e.target.value) : undefined)}
                            className="w-full pl-7 h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    <span className="text-amber-600">
                      {item.monthlyPayment.missingReason || 'Cannot calculate payment'}
                    </span>
                    {item.needsTermYears && (
                      <p className="mt-1 text-xs">
                        Add the loan term above to enable calculation for repayment mortgages.
                      </p>
                    )}
                  </div>
                )}
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

            {/* Missing Passport Fields */}
            {item.missingPassportFields.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-blue-600 mb-3 flex items-center gap-2">
                  Missing Passport ({remainingPassportMissing.length} remaining)
                  {item.missingCriticalPassportFields.length > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      {item.missingCriticalPassportFields.length} critical
                    </Badge>
                  )}
                  {Object.keys(passportChanges).length > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(passportChanges).length} filled
                    </Badge>
                  )}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {item.missingPassportFields.map(fieldKey => {
                    const fieldDef = PASSPORT_FIELDS.find(f => f.key === fieldKey);
                    if (!fieldDef) return null;
                    const isFilled = fieldKey in passportChanges;
                    const isCritical = CRITICAL_PASSPORT_FIELDS.includes(fieldKey);
                    return (
                      <div key={fieldKey} className={`${isFilled ? 'opacity-50' : ''} ${isCritical ? 'ring-1 ring-red-500/30 rounded-md p-2 -m-2' : ''}`}>
                        <MissingFieldEditor
                          field={fieldDef}
                          value={passportChanges[fieldKey]}
                          onChange={val => handlePassportChange(fieldKey, val)}
                          isFilled={isFilled}
                        />
                        {isCritical && !isFilled && (
                          <span className="text-xs text-destructive mt-1 block">Critical field</span>
                        )}
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
