import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Activity, TrendingUp, TrendingDown, ExternalLink, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { 
  calculateHealthScore, 
  calculateLTV, 
  getEffectiveCosts,
  getHealthGrade,
  getHealthStatus,
  HealthScoreBreakdown,
} from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface PortfolioHealthWidgetProps {
  properties: PropertyWithFinancials[];
  onClick?: () => void;
}

interface PropertyScore {
  id: string;
  address: string;
  score: HealthScoreBreakdown;
}

export function PortfolioHealthWidget({ properties, onClick }: PortfolioHealthWidgetProps) {
  const propertyScores = useMemo<PropertyScore[]>(() => {
    const currentYear = new Date().getFullYear();
    
    return properties.map(property => {
      const loan = property.loans?.[0];
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);

      const mortgageBalance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null;
      const currentValue = property.current_value_gbp ? Number(property.current_value_gbp) : null;
      const annualRent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;
      
      // Use effective costs (auto-calculated with manual overrides)
      const effectiveCosts = getEffectiveCosts(annualRent, currentValue, costs);
      const totalCosts = effectiveCosts.total;

      const ltv = calculateLTV(mortgageBalance, currentValue);
      const mortgagePayment = loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null;
      const isInterestOnly = loan?.capital_or_interest === 'interest';

      const score = calculateHealthScore({
        annualRent,
        totalCosts,
        mortgagePayment,
        ltv,
        fixedRateExpires: loan?.fixed_rate_expires || null,
        isInterestOnly,
        epcRating: property.epc_rating,
      });

      return {
        id: property.id,
        address: property.address_line,
        score,
      };
    }).sort((a, b) => a.score.total - b.score.total); // Worst first
  }, [properties]);

  // Calculate portfolio average
  const portfolioAverage = useMemo(() => {
    if (!propertyScores.length) return 0;
    const total = propertyScores.reduce((sum, p) => sum + p.score.total, 0);
    return Math.round(total / propertyScores.length);
  }, [propertyScores]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const dist = { A: 0, B: 0, C: 0, D: 0, F: 0 };
    propertyScores.forEach(p => {
      const grade = getHealthGrade(p.score.total);
      dist[grade]++;
    });
    return dist;
  }, [propertyScores]);

  const avgGrade = getHealthGrade(portfolioAverage);
  const avgStatus = getHealthStatus(avgGrade);

  // Get bottom 3 performers
  const bottomPerformers = propertyScores.slice(0, 3);

  const statusColors = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  };

  const statusBg = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-destructive',
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (onClick && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card 
      className={cn(
        "bg-card border-border transition-all duration-200",
        onClick && [
          "cursor-pointer",
          "hover:bg-muted/50 hover:border-primary/50",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "active:scale-[0.99]",
        ]
      )}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={handleCardClick}
      onKeyDown={onClick ? handleKeyDown : undefined}
      aria-label={onClick ? "View details for Portfolio Health" : undefined}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Portfolio Health
        </CardTitle>
        {onClick && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Score */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-2">
              <span className={`text-4xl font-bold ${statusColors[avgStatus]}`}>
                {avgGrade}
              </span>
              <span className="text-muted-foreground text-sm">
                {portfolioAverage}/100 average
              </span>
            </div>
            <Progress 
              value={portfolioAverage} 
              className="h-2"
            />
          </div>
        </div>

        {/* Grade Distribution */}
        <div className="grid grid-cols-5 gap-2">
          {(['A', 'B', 'C', 'D', 'F'] as const).map(grade => {
            const count = gradeDistribution[grade];
            const status = getHealthStatus(grade);
            return (
              <div key={grade} className="text-center">
                <div className={`text-lg font-bold ${statusColors[status]}`}>
                  {count}
                </div>
                <div className="text-xs text-muted-foreground">
                  Grade {grade}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Performers */}
        {bottomPerformers.length > 0 && bottomPerformers[0].score.total < 70 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="h-4 w-4" />
              <span>Needs Attention</span>
            </div>
            <div className="space-y-2">
              {bottomPerformers.filter(p => p.score.total < 70).map(property => {
                const grade = getHealthGrade(property.score.total);
                const status = getHealthStatus(grade);
                return (
                  <Link
                    key={property.id}
                    to={`/properties/${property.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Badge 
                      variant="outline" 
                      className={`${
                        status === 'danger' ? 'status-danger border' : 'status-warning border'
                      } text-xs font-semibold`}
                    >
                      {grade}
                    </Badge>
                    <span className="flex-1 text-sm truncate">{property.address}</span>
                    <span className="text-xs text-muted-foreground">{property.score.total}/100</span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* All healthy message */}
        {portfolioAverage >= 70 && (
          <div className="flex items-center gap-2 text-success text-sm">
            <TrendingUp className="h-4 w-4" />
            <span>Portfolio is in good health</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
