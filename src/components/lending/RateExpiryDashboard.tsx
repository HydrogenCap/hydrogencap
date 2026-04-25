import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, ArrowUpRight } from 'lucide-react';
import { useRateExpiries } from '@/hooks/useRefinanceWorkflow';
import { fmtGBP, fmtDate } from '@/hooks/useLoanFacilities';

interface Props {
  onStartRefinance?: (facilityId: string) => void;
}

const SEVERITY_CONFIG = {
  black: {
    label: 'On SVR',
    dot: 'bg-gray-900 dark:bg-gray-100',
    row: 'bg-gray-50 dark:bg-gray-950/30',
    badge: 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900',
  },
  red: {
    label: '<3 months',
    dot: 'bg-red-500',
    row: 'bg-red-50/40 dark:bg-red-950/20',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
  amber: {
    label: '3-6 months',
    dot: 'bg-amber-500',
    row: 'bg-amber-50/40 dark:bg-amber-950/20',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  },
  green: {
    label: '>6 months',
    dot: 'bg-emerald-500',
    row: '',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
};

export function RateExpiryDashboard({ onStartRefinance }: Props) {
  const expiries = useRateExpiries();

  const counts = {
    black: expiries.filter((e) => e.severity === 'black').length,
    red: expiries.filter((e) => e.severity === 'red').length,
    amber: expiries.filter((e) => e.severity === 'amber').length,
    green: expiries.filter((e) => e.severity === 'green').length,
  };

  if (expiries.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-1">No active loan facilities</h3>
          <p className="text-muted-foreground text-sm">
            Add loan facilities to track rate expiry dates.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['black', 'red', 'amber', 'green'] as const).map((severity) => (
          <Card key={severity}>
            <CardContent className="pt-4 flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${SEVERITY_CONFIG[severity].dot}`}
              />
              <div>
                <p className="text-xs text-muted-foreground">
                  {SEVERITY_CONFIG[severity].label}
                </p>
                <p className="text-lg font-bold">{counts[severity]}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Expiry Table */}
      <Card>
        <CardHeader>
          <CardTitle>Rate Expiry Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="pb-2 font-medium w-4"></th>
                  <th className="pb-2 font-medium">Property</th>
                  <th className="pb-2 font-medium">Lender</th>
                  <th className="pb-2 font-medium text-right">Balance</th>
                  <th className="pb-2 font-medium text-right">Current Rate</th>
                  <th className="pb-2 font-medium text-right">SVR</th>
                  <th className="pb-2 font-medium text-right">Rate Expiry</th>
                  <th className="pb-2 font-medium text-right">Days Left</th>
                  <th className="pb-2 font-medium text-right">SVR Impact</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {expiries.map((e) => {
                  const config = SEVERITY_CONFIG[e.severity];
                  return (
                    <tr
                      key={e.id}
                      className={`border-b last:border-0 ${config.row}`}
                    >
                      <td className="py-2">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${config.dot}`}
                        />
                      </td>
                      <td className="py-2">
                        <Link
                          to={`/properties-v2/${e.property_id}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {e.property_address}
                        </Link>
                      </td>
                      <td className="py-2">{e.lender_name}</td>
                      <td className="py-2 text-right font-medium">
                        {fmtGBP(e.current_balance)}
                      </td>
                      <td className="py-2 text-right">
                        {e.interest_rate.toFixed(2)}%
                        <span className="text-xs text-muted-foreground ml-1 capitalize">
                          {e.rate_type}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {e.revert_rate != null ? `${e.revert_rate}%` : '—'}
                      </td>
                      <td className="py-2 text-right">
                        {fmtDate(e.rate_expiry_date)}
                      </td>
                      <td className="py-2 text-right">
                        <Badge className={config.badge}>
                          {e.daysToExpiry != null
                            ? e.daysToExpiry <= 0
                              ? 'Expired'
                              : `${e.daysToExpiry}d`
                            : 'N/A'}
                        </Badge>
                      </td>
                      <td className="py-2 text-right">
                        {e.svrPaymentIncrease != null ? (
                          <span className="text-red-600 font-medium">
                            +{fmtGBP(e.svrPaymentIncrease)}/mo
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {onStartRefinance && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onStartRefinance(e.id)}
                          >
                            <ArrowUpRight className="h-3.5 w-3.5 mr-1" />
                            Refinance
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
