import { Shield, AlertCircle, AlertTriangle, ClipboardCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { type PortfolioInsights } from '@/lib/portfolioInsights';
import { formatPercent } from '@/lib/calculations';

interface RiskExposureCardProps {
  portfolioInsights: PortfolioInsights;
}

export function RiskExposureCard({ portfolioInsights }: RiskExposureCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Risk Exposure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="h-4 w-4 text-destructive" />
              <span className="text-sm font-medium">LTV &gt;85%</span>
            </div>
            <div className="text-2xl font-bold">{portfolioInsights.risk.ltvAbove85.count}</div>
            <div className="text-xs text-muted-foreground">
              {formatPercent(portfolioInsights.risk.ltvAbove85.percent, 0)} of value
            </div>
          </div>
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">LTV 75-85%</span>
            </div>
            <div className="text-2xl font-bold">{portfolioInsights.risk.ltvAbove75.count}</div>
            <div className="text-xs text-muted-foreground">
              {formatPercent(portfolioInsights.risk.ltvAbove75.percent, 0)} of value
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="text-sm font-medium">EPC Below C</div>
              <div className="text-xs text-muted-foreground">Need improvement</div>
            </div>
            <div className="text-2xl font-bold">{portfolioInsights.risk.epcBelowC.count}</div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="text-sm font-medium">Pre-2000</div>
              <div className="text-xs text-muted-foreground">Older buildings</div>
            </div>
            <div className="text-2xl font-bold">{portfolioInsights.risk.pre2000Count}</div>
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">Passport Completeness</div>
              <div className="text-xs text-muted-foreground">
                {portfolioInsights.operational.propertiesMissingCritical.count} missing critical data
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Progress
              value={portfolioInsights.operational.averagePassportCompleteness}
              className="w-20 h-2"
            />
            <span className="text-sm font-medium">
              {formatPercent(portfolioInsights.operational.averagePassportCompleteness, 0)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
