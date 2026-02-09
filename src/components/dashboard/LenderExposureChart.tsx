import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { SectionCard } from '@/components/dashboard/SectionCard';
import { formatGBP } from '@/lib/calculations';
import { PropertyWithFinancials } from '@/hooks/useProperties';

const CHART_COLORS = [
  'hsl(174, 72%, 45%)',
  'hsl(190, 80%, 50%)',
  'hsl(200, 85%, 55%)',
  'hsl(280, 70%, 55%)',
  'hsl(320, 75%, 50%)',
  'hsl(38, 92%, 50%)',
  'hsl(142, 70%, 45%)',
];

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
  return (
    <SectionCard title="Lender Exposure" icon={BarChart3}>
      {lenderData.length > 0 ? (
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={lenderData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                dataKey="value"
                nameKey="name"
                label={({ name, percent }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {lenderData.map((_, index) => (
                  <Cell
                    key={`lender-${index}`}
                    fill={CHART_COLORS[index % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => formatGBP(value)}
                contentStyle={{
                  backgroundColor: 'hsl(222 47% 8%)',
                  border: '1px solid hsl(220 25% 16%)',
                  borderRadius: '0.5rem',
                  color: 'hsl(210 40% 98%)',
                }}
                labelStyle={{ color: 'hsl(210 40% 98%)' }}
                itemStyle={{ color: 'hsl(210 40% 98%)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="h-[250px] flex items-center justify-center text-muted-foreground">
          <p>Add properties with mortgages to see lender breakdown</p>
        </div>
      )}
    </SectionCard>
  );
}
