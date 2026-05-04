import React, { useState, useEffect } from 'react';
import { RotateCcw, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { formatGBP, calculateCostRules, getEffectiveCosts, type CostsData } from '@/lib/calculations';
import { useUpsertPropertyCostBudget, yearToTaxYear } from '@/hooks/usePropertyCostBudgets';
import { useToast } from '@/hooks/use-toast';

interface CostsEditorProps {
  propertyId: string;
  year: number;
  costs: CostsData | null | undefined;
  grossRent: number | null;
  propertyValue: number | null;
  onSave?: () => void;
}

const DEFAULT_RULES = {
  management_rule_percent_of_rent: 5.0,
  repairs_rule_percent_of_rent: 5.0,
  insurance_rule_percent_of_value: 0.3,
};

export function CostsEditor({
  propertyId,
  year,
  costs,
  grossRent,
  propertyValue,
  onSave,
}: CostsEditorProps) {
  const { toast } = useToast();
  const upsertCosts = useUpsertPropertyCostBudget();

  // Rule toggles
  const [managementRuleEnabled, setManagementRuleEnabled] = useState(costs?.management_rule_enabled ?? true);
  const [repairsRuleEnabled, setRepairsRuleEnabled] = useState(costs?.repairs_rule_enabled ?? true);
  const [insuranceRuleEnabled, setInsuranceRuleEnabled] = useState(costs?.insurance_rule_enabled ?? true);

  // Rule percentages
  const [managementPercent, setManagementPercent] = useState(String(costs?.management_rule_percent_of_rent ?? DEFAULT_RULES.management_rule_percent_of_rent));
  const [repairsPercent, setRepairsPercent] = useState(String(costs?.repairs_rule_percent_of_rent ?? DEFAULT_RULES.repairs_rule_percent_of_rent));
  const [insurancePercent, setInsurancePercent] = useState(String(costs?.insurance_rule_percent_of_value ?? DEFAULT_RULES.insurance_rule_percent_of_value));

  // Manual amounts
  const [managementManual, setManagementManual] = useState(costs?.management_gbp_manual ? String(costs.management_gbp_manual) : '');
  const [repairsManual, setRepairsManual] = useState(costs?.repairs_gbp_manual ? String(costs.repairs_gbp_manual) : '');
  const [insuranceManual, setInsuranceManual] = useState(costs?.insurance_gbp_manual ? String(costs.insurance_gbp_manual) : '');
  const [billsManual, setBillsManual] = useState(costs?.bills_gbp_manual ? String(costs.bills_gbp_manual) : '');
  const [complianceManual, setComplianceManual] = useState(costs?.compliance_gbp_manual ? String(costs.compliance_gbp_manual) : '');
  const [otherManual, setOtherManual] = useState(costs?.other_gbp_manual ? String(costs.other_gbp_manual) : '');

  // Update local state when props change
  useEffect(() => {
    if (costs) {
      setManagementRuleEnabled(costs.management_rule_enabled ?? true);
      setRepairsRuleEnabled(costs.repairs_rule_enabled ?? true);
      setInsuranceRuleEnabled(costs.insurance_rule_enabled ?? true);
      setManagementPercent(String(costs.management_rule_percent_of_rent ?? DEFAULT_RULES.management_rule_percent_of_rent));
      setRepairsPercent(String(costs.repairs_rule_percent_of_rent ?? DEFAULT_RULES.repairs_rule_percent_of_rent));
      setInsurancePercent(String(costs.insurance_rule_percent_of_value ?? DEFAULT_RULES.insurance_rule_percent_of_value));
      setManagementManual(costs.management_gbp_manual ? String(costs.management_gbp_manual) : '');
      setRepairsManual(costs.repairs_gbp_manual ? String(costs.repairs_gbp_manual) : '');
      setInsuranceManual(costs.insurance_gbp_manual ? String(costs.insurance_gbp_manual) : '');
      setBillsManual(costs.bills_gbp_manual ? String(costs.bills_gbp_manual) : '');
      setComplianceManual(costs.compliance_gbp_manual ? String(costs.compliance_gbp_manual) : '');
      setOtherManual(costs.other_gbp_manual ? String(costs.other_gbp_manual) : '');
    }
  }, [costs]);

  // Calculate auto values
  const currentCostsData: CostsData = {
    management_rule_enabled: managementRuleEnabled,
    management_rule_percent_of_rent: parseFloat(managementPercent) || DEFAULT_RULES.management_rule_percent_of_rent,
    repairs_rule_enabled: repairsRuleEnabled,
    repairs_rule_percent_of_rent: parseFloat(repairsPercent) || DEFAULT_RULES.repairs_rule_percent_of_rent,
    insurance_rule_enabled: insuranceRuleEnabled,
    insurance_rule_percent_of_value: parseFloat(insurancePercent) || DEFAULT_RULES.insurance_rule_percent_of_value,
    management_gbp_manual: managementManual ? parseFloat(managementManual) : null,
    repairs_gbp_manual: repairsManual ? parseFloat(repairsManual) : null,
    insurance_gbp_manual: insuranceManual ? parseFloat(insuranceManual) : null,
    bills_gbp_manual: billsManual ? parseFloat(billsManual) : null,
    compliance_gbp_manual: complianceManual ? parseFloat(complianceManual) : null,
    other_gbp_manual: otherManual ? parseFloat(otherManual) : null,
  };

  const calculatedRules = calculateCostRules(grossRent, propertyValue, currentCostsData);
  const effectiveCosts = getEffectiveCosts(grossRent, propertyValue, currentCostsData);

  const handleResetToDefaults = () => {
    setManagementRuleEnabled(true);
    setRepairsRuleEnabled(true);
    setInsuranceRuleEnabled(true);
    setManagementPercent(String(DEFAULT_RULES.management_rule_percent_of_rent));
    setRepairsPercent(String(DEFAULT_RULES.repairs_rule_percent_of_rent));
    setInsurancePercent(String(DEFAULT_RULES.insurance_rule_percent_of_value));
    setManagementManual('');
    setRepairsManual('');
    setInsuranceManual('');
  };

  const handleSave = async () => {
    try {
      await upsertCosts.mutateAsync({
        property_id: propertyId,
        year,
        management_rule_enabled: managementRuleEnabled,
        management_rule_percent_of_rent: parseFloat(managementPercent) || DEFAULT_RULES.management_rule_percent_of_rent,
        management_gbp_manual: managementManual ? parseFloat(managementManual) : null,
        management_gbp_calculated: calculatedRules.management,
        repairs_rule_enabled: repairsRuleEnabled,
        repairs_rule_percent_of_rent: parseFloat(repairsPercent) || DEFAULT_RULES.repairs_rule_percent_of_rent,
        repairs_gbp_manual: repairsManual ? parseFloat(repairsManual) : null,
        repairs_gbp_calculated: calculatedRules.repairs,
        insurance_rule_enabled: insuranceRuleEnabled,
        insurance_rule_percent_of_value: parseFloat(insurancePercent) || DEFAULT_RULES.insurance_rule_percent_of_value,
        insurance_gbp_manual: insuranceManual ? parseFloat(insuranceManual) : null,
        insurance_gbp_calculated: calculatedRules.insurance,
        bills_gbp_manual: billsManual ? parseFloat(billsManual) : null,
        compliance_gbp_manual: complianceManual ? parseFloat(complianceManual) : null,
        other_gbp_manual: otherManual ? parseFloat(otherManual) : null,
      });
      toast({ title: 'Costs saved', description: `Costs for ${year} have been updated` });
      onSave?.();
    } catch (error) {
      console.error('Failed to save costs:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save costs', variant: 'destructive' });
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Annual Costs ({year})</CardTitle>
        <Button variant="outline" size="sm" onClick={handleResetToDefaults}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset to Defaults
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto-calculated costs with rules */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Auto-Calculated Costs
          </h4>

          {/* Management */}
          <CostRuleRow
            label="Management"
            tooltip="Property management fee as a percentage of gross annual rent"
            ruleEnabled={managementRuleEnabled}
            onRuleEnabledChange={setManagementRuleEnabled}
            rulePercent={managementPercent}
            onRulePercentChange={setManagementPercent}
            ruleLabel="% of rent"
            calculatedAmount={calculatedRules.management}
            manualAmount={managementManual}
            onManualAmountChange={setManagementManual}
            effectiveAmount={effectiveCosts.management}
            effectiveSource={effectiveCosts.managementSource}
          />

          {/* Insurance */}
          <CostRuleRow
            label="Insurance"
            tooltip="Annual insurance premium as a percentage of property value"
            ruleEnabled={insuranceRuleEnabled}
            onRuleEnabledChange={setInsuranceRuleEnabled}
            rulePercent={insurancePercent}
            onRulePercentChange={setInsurancePercent}
            ruleLabel="% of value"
            calculatedAmount={calculatedRules.insurance}
            manualAmount={insuranceManual}
            onManualAmountChange={setInsuranceManual}
            effectiveAmount={effectiveCosts.insurance}
            effectiveSource={effectiveCosts.insuranceSource}
          />

          {/* Repairs */}
          <CostRuleRow
            label="Repairs/Maintenance"
            tooltip="Annual repairs and maintenance allowance as a percentage of gross rent"
            ruleEnabled={repairsRuleEnabled}
            onRuleEnabledChange={setRepairsRuleEnabled}
            rulePercent={repairsPercent}
            onRulePercentChange={setRepairsPercent}
            ruleLabel="% of rent"
            calculatedAmount={calculatedRules.repairs}
            manualAmount={repairsManual}
            onManualAmountChange={setRepairsManual}
            effectiveAmount={effectiveCosts.repairs}
            effectiveSource={effectiveCosts.repairsSource}
          />
        </div>

        {/* Manual-only costs */}
        <div className="space-y-4 border-t border-border pt-4">
          <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Manual Costs
          </h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Bills (annual)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={billsManual}
                  onChange={(e) => setBillsManual(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Compliance (annual)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={complianceManual}
                  onChange={(e) => setComplianceManual(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label>Other (annual)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">£</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={otherManual}
                  onChange={(e) => setOtherManual(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="border-t border-border pt-4">
          <div className="flex justify-between items-center text-lg font-medium">
            <span>Total Annual Costs</span>
            <span className="text-primary">{formatGBP(effectiveCosts.total)}</span>
          </div>
        </div>

        {/* Save button */}
        <Button onClick={handleSave} className="w-full" disabled={upsertCosts.isPending}>
          {upsertCosts.isPending ? 'Saving...' : 'Save Costs'}
        </Button>
      </CardContent>
    </Card>
  );
}

interface CostRuleRowProps {
  label: string;
  tooltip: string;
  ruleEnabled: boolean;
  onRuleEnabledChange: (enabled: boolean) => void;
  rulePercent: string;
  onRulePercentChange: (value: string) => void;
  ruleLabel: string;
  calculatedAmount: number | null;
  manualAmount: string;
  onManualAmountChange: (value: string) => void;
  effectiveAmount: number;
  effectiveSource: 'auto' | 'manual';
}

function CostRuleRow({
  label,
  tooltip,
  ruleEnabled,
  onRuleEnabledChange,
  rulePercent,
  onRulePercentChange,
  ruleLabel,
  calculatedAmount,
  manualAmount,
  onManualAmountChange,
  effectiveAmount,
  effectiveSource,
}: CostRuleRowProps) {
  return (
    <div className="space-y-2 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="font-medium">{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Auto</span>
          <Switch checked={ruleEnabled} onCheckedChange={onRuleEnabledChange} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Rule percentage */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rule</Label>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={rulePercent}
              onChange={(e) => onRulePercentChange(e.target.value)}
              className="h-8 text-sm"
              disabled={!ruleEnabled}
            />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{ruleLabel}</span>
          </div>
          {ruleEnabled && calculatedAmount !== null && (
            <span className="text-xs text-muted-foreground">= {formatGBP(calculatedAmount)}</span>
          )}
        </div>

        {/* Manual override */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Manual Override</Label>
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">£</span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={manualAmount}
              onChange={(e) => onManualAmountChange(e.target.value)}
              placeholder="—"
              className="h-8 text-sm"
            />
          </div>
        </div>

        {/* Effective (final) amount */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Final Amount</Label>
          <div className="flex items-center gap-2">
            <span className="font-medium">{formatGBP(effectiveAmount)}</span>
            <Badge variant="outline" className="text-xs">
              {effectiveSource === 'auto' ? 'Auto' : 'Manual'}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  );
}