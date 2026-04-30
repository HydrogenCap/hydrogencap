import { useState } from 'react';
import { toast } from 'sonner';
import { getCurrentTaxYear, getRecentTaxYears } from '@/lib/accountingTypes';
import { useTaxCalculation, useTaxProfile, useUpsertTaxProfile } from '@/hooks/useTaxEngine';

export type TaxpayerType = 'individual' | 'partnership' | 'company';

export function useTaxDashboardState() {
  const [taxYear, setTaxYear] = useState(getCurrentTaxYear());
  const [activeTab, setActiveTab] = useState('overview');
  const taxYears = getRecentTaxYears(5);

  const { data: taxProfile } = useTaxProfile(taxYear);
  const upsertProfile = useUpsertTaxProfile();
  const { data: calculation, isLoading } = useTaxCalculation(taxYear);

  const [otherIncome, setOtherIncome] = useState('');
  const [personalAllowance, setPersonalAllowance] = useState('12570');
  const [taxpayerType, setTaxpayerType] = useState<TaxpayerType>('individual');

  // Sync from loaded profile (preserved exact original logic)
  const profileLoaded = taxProfile != null;
  if (profileLoaded && otherIncome === '' && taxProfile.other_income > 0) {
    setOtherIncome(String(taxProfile.other_income));
  }
  if (profileLoaded && taxProfile.personal_allowance !== Number(personalAllowance)) {
    setPersonalAllowance(String(taxProfile.personal_allowance));
  }
  if (profileLoaded && taxProfile.taxpayer_type !== taxpayerType) {
    setTaxpayerType(taxProfile.taxpayer_type as TaxpayerType);
  }

  const handleSaveProfile = () => {
    upsertProfile.mutate(
      {
        taxYear,
        taxpayerType,
        otherIncome: parseFloat(otherIncome) || 0,
        personalAllowance: parseFloat(personalAllowance) || 12570,
      },
      {
        onSuccess: () => toast.success('Tax profile saved'),
      },
    );
  };

  const s24ChartData = calculation
    ? [
        {
          name: 'Old System\n(pre-S24)',
          tax: Math.round(calculation.section24Impact.oldSystemTax),
          fill: 'hsl(var(--cat-1))',
        },
        {
          name: 'New System\n(Section 24)',
          tax: Math.round(calculation.section24Impact.newSystemTax),
          fill: 'hsl(var(--cat-2))',
        },
      ]
    : [];

  const s24Additional = calculation?.section24Impact.additionalTaxDueToSection24 ?? 0;

  return {
    taxYear, setTaxYear, taxYears,
    activeTab, setActiveTab,
    calculation, isLoading,
    otherIncome, setOtherIncome,
    personalAllowance, setPersonalAllowance,
    taxpayerType, setTaxpayerType,
    upsertProfile, handleSaveProfile,
    s24ChartData, s24Additional,
  };
}
