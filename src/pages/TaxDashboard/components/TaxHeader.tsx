import { Calculator } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DensityToggle } from '@/components/DensityToggle';

export function TaxHeader({
  taxYear,
  setTaxYear,
  taxYears,
}: {
  taxYear: string;
  setTaxYear: (v: string) => void;
  taxYears: string[];
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Tax Engine
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          UK property tax — Section 24, SA105 &amp; Capital Gains estimates
        </p>
      </div>
      <div className="flex items-center gap-3">
        <DensityToggle />
        <Select value={taxYear} onValueChange={setTaxYear}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {taxYears.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
