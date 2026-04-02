/* eslint-disable react-refresh/only-export-components -- mixed exports are intentional in this shared module */
import { CompliancePieChart } from '@/components/charts';
import { CHART_SEQUENCE } from '@/lib/chart-tokens';
import { formatGBP } from '@/lib/calculations';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

interface LenderEntry {
  name: string;
  value: number;
}

export function computeLenderData(properties: PropertyWithFinancials[]): LenderEntry[] {
  if (!properties?.length) return [];

  const lenderMap: Record<string, number> = {};
  const canonicalNames: Record<string, string> = {};

  properties.forEach((property) => {
    const loan = property.loans?.[0];
    if (loan?.lender && loan.current_mortgage_balance_gbp) {
      const normalizedKey = loan.lender.trim().toLowerCase().replace(/\s+/g, ' ');
      if (!canonicalNames[normalizedKey]) {
        canonicalNames[normalizedKey] = loan.lender.trim();
      }
      lenderMap[normalizedKey] =
        (lenderMap[normalizedKey] || 0) + Number(loan.current_mortgage_balance_gbp);
    }
  });

  return Object.entries(lenderMap)
    .map(([key, value]) => ({ name: canonicalNames[key], value }))
    .sort((a, b) => b.value - a.value);
}

interface Props {
  lenderData: LenderEntry[];
}

export function LenderExposureChart({ lenderData }: Props) {
  const pieData = lenderData.map((entry, i) => ({
    name: entry.name,
    value: entry.value,
    colour: CHART_SEQUENCE[i % CHART_SEQUENCE.length],
  }));

  return (
    <CompliancePieChart
      data={pieData}
      title="Lender Exposure"
      height={250}
      emptyMessage="Add properties with mortgages to see lender breakdown"
      formatValue={formatGBP}
      innerRadius={60}
      outerRadius={80}
    />
  );
}
