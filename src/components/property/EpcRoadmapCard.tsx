import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Leaf } from 'lucide-react';

interface EpcMeasure {
  name: string;
  typicalCostRange: string;
  impact: 'high' | 'medium' | 'low';
}

const EPC_MEASURES: Record<string, EpcMeasure[]> = {
  G: [
    { name: 'Loft insulation (270mm)', typicalCostRange: '£300–£600', impact: 'high' },
    { name: 'Cavity wall insulation', typicalCostRange: '£400–£800', impact: 'high' },
    { name: 'Boiler replacement (A-rated)', typicalCostRange: '£2,000–£4,000', impact: 'high' },
    { name: 'Heating controls upgrade', typicalCostRange: '£150–£400', impact: 'medium' },
    { name: 'Draught-proofing', typicalCostRange: '£80–£200', impact: 'medium' },
    { name: 'LED lighting throughout', typicalCostRange: '£100–£300', impact: 'low' },
  ],
  F: [
    { name: 'Loft insulation (270mm)', typicalCostRange: '£300–£600', impact: 'high' },
    { name: 'Cavity wall insulation', typicalCostRange: '£400–£800', impact: 'high' },
    { name: 'Boiler replacement (A-rated)', typicalCostRange: '£2,000–£4,000', impact: 'high' },
    { name: 'Heating controls upgrade', typicalCostRange: '£150–£400', impact: 'medium' },
    { name: 'Double glazing', typicalCostRange: '£4,000–£10,000', impact: 'medium' },
  ],
  E: [
    { name: 'Loft insulation top-up', typicalCostRange: '£300–£600', impact: 'high' },
    { name: 'Solar PV panels', typicalCostRange: '£4,000–£8,000', impact: 'high' },
    { name: 'Heat pump (air source)', typicalCostRange: '£7,000–£15,000', impact: 'high' },
    { name: 'Floor insulation', typicalCostRange: '£800–£1,800', impact: 'medium' },
    { name: 'Smart thermostat', typicalCostRange: '£100–£250', impact: 'medium' },
  ],
  D: [
    { name: 'Solar PV panels', typicalCostRange: '£4,000–£8,000', impact: 'high' },
    { name: 'Heat pump (air source)', typicalCostRange: '£7,000–£15,000', impact: 'high' },
    { name: 'Double / triple glazing upgrade', typicalCostRange: '£4,000–£10,000', impact: 'medium' },
    { name: 'Smart thermostat', typicalCostRange: '£100–£250', impact: 'medium' },
  ],
};

const EPC_BADGE: Record<string, string> = {
  A: 'bg-green-600 text-white',
  B: 'bg-green-500 text-white',
  C: 'bg-lime-500 text-white',
  D: 'bg-yellow-400 text-gray-900',
  E: 'bg-orange-400 text-white',
  F: 'bg-orange-600 text-white',
  G: 'bg-red-600 text-white',
};

const IMPACT_COLOR = {
  high: 'text-emerald-600',
  medium: 'text-amber-600',
  low: 'text-muted-foreground',
};

interface EpcRoadmapCardProps {
  epcRating: string | null | undefined;
}

export function EpcRoadmapCard({ epcRating }: EpcRoadmapCardProps) {
  const rating = epcRating?.toUpperCase();
  if (!rating || !['D', 'E', 'F', 'G'].includes(rating)) return null;

  const measures = EPC_MEASURES[rating] ?? EPC_MEASURES.D;

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Leaf className="h-4 w-4 text-emerald-600" />
          EPC Improvement Roadmap
          <Badge className={EPC_BADGE[rating] ?? 'bg-gray-500 text-white'}>
            EPC {rating}
          </Badge>
          <span className="text-muted-foreground font-normal text-sm">→ target C</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          From 2028, new tenancies will require a minimum EPC C rating. Recommended
          improvements for this property:
        </p>
        <div className="space-y-2">
          {measures.map((m, i) => (
            <div
              key={i}
              className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
            >
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium uppercase w-12 shrink-0 ${IMPACT_COLOR[m.impact]}`}
                >
                  {m.impact}
                </span>
                <span>{m.name}</span>
              </div>
              <span className="text-muted-foreground text-xs shrink-0 ml-2">
                {m.typicalCostRange}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Costs are indicative. Consult a qualified energy assessor for a full improvement
          report (EPC surveyor or Retrofit Coordinator).
        </p>
      </CardContent>
    </Card>
  );
}
