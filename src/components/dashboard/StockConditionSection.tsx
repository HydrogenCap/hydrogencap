import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Home, AlertTriangle, CheckCircle2, Clock, XCircle, ExternalLink, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usePassportsWithProperties, calculatePassportCompleteness, getHMOLicenceStatus, type PropertyPassport } from '@/hooks/usePropertyPassport';
import { formatDateUK } from '@/lib/calculations';

interface PropertyWithPassport {
  id: string;
  address_line_1: string;
  postcode: string | null;
  county: string | null;
  passport: PropertyPassport | null;
}

export function StockConditionSection() {
  const { data: propertiesWithPassports, isLoading } = usePassportsWithProperties();

  // Calculate completeness stats
  const stats = useMemo(() => {
    if (!propertiesWithPassports?.length) {
      return {
        totalProperties: 0,
        avgCompleteness: 0,
        propertiesMissingCritical: [] as PropertyWithPassport[],
        hmoLicences: {
          overdue: [] as PropertyWithPassport[],
          expiringSoon: [] as PropertyWithPassport[],
          valid: [] as PropertyWithPassport[],
        },
      };
    }

    let totalCompleteness = 0;
    const propertiesMissingCritical: PropertyWithPassport[] = [];
    const hmoLicences = {
      overdue: [] as PropertyWithPassport[],
      expiringSoon: [] as PropertyWithPassport[],
      valid: [] as PropertyWithPassport[],
    };

    propertiesWithPassports.forEach(prop => {
      const completeness = calculatePassportCompleteness(prop.passport);
      totalCompleteness += completeness.percentage;

      if (completeness.criticalMissing.length > 0) {
        propertiesMissingCritical.push(prop);
      }

      const hmoStatus = getHMOLicenceStatus(prop.passport);
      if (hmoStatus === 'overdue') {
        hmoLicences.overdue.push(prop);
      } else if (hmoStatus === 'expiring_soon') {
        hmoLicences.expiringSoon.push(prop);
      } else if (hmoStatus === 'valid') {
        hmoLicences.valid.push(prop);
      }
    });

    return {
      totalProperties: propertiesWithPassports.length,
      avgCompleteness: Math.round(totalCompleteness / propertiesWithPassports.length),
      propertiesMissingCritical,
      hmoLicences,
    };
  }, [propertiesWithPassports]);

  if (isLoading) {
    return null; // Will show once data loads
  }

  if (!propertiesWithPassports?.length) {
    return null;
  }

  const completenessColor = stats.avgCompleteness >= 80 
    ? 'text-success' 
    : stats.avgCompleteness >= 50 
      ? 'text-warning' 
      : 'text-destructive';

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Home className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Stock Condition & Asset Passport</h2>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* A) Passport Completeness KPI */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Passport Completeness
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-3xl font-bold ${completenessColor}`}>
                  {stats.avgCompleteness}%
                </span>
                <span className="text-muted-foreground text-sm">average</span>
              </div>
              <Progress value={stats.avgCompleteness} className="h-2" />
              {stats.propertiesMissingCritical.length > 0 ? (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  {stats.propertiesMissingCritical.length} properties missing critical info
                </p>
              ) : (
                <p className="text-sm text-success flex items-center gap-1">
                  <CheckCircle2 className="h-4 w-4" />
                  All critical fields complete
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* C) Licensing Snapshot */}
        <Card className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              HMO Licensing Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.hmoLicences.overdue.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span className="text-destructive font-medium">Overdue</span>
                  </span>
                  <Badge variant="destructive">{stats.hmoLicences.overdue.length}</Badge>
                </div>
              )}
              {stats.hmoLicences.expiringSoon.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-warning" />
                    <span className="text-warning font-medium">Expiring in 30 days</span>
                  </span>
                  <Badge className="bg-warning/20 text-warning border-warning">{stats.hmoLicences.expiringSoon.length}</Badge>
                </div>
              )}
              {stats.hmoLicences.valid.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-success font-medium">Valid</span>
                  </span>
                  <Badge className="bg-success/20 text-success border-success">{stats.hmoLicences.valid.length}</Badge>
                </div>
              )}
              {stats.hmoLicences.overdue.length === 0 && 
               stats.hmoLicences.expiringSoon.length === 0 && 
               stats.hmoLicences.valid.length === 0 && (
                <p className="text-sm text-muted-foreground">No HMO licences tracked</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* B) Missing Critical Info List */}
        <Card className="bg-card border-border md:row-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileWarning className="h-5 w-5 text-warning" />
              Missing Critical Info
              {stats.propertiesMissingCritical.length > 0 && (
                <Badge variant="outline" className="ml-auto">
                  {stats.propertiesMissingCritical.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.propertiesMissingCritical.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success" />
                <p className="text-sm">All properties have critical operational data</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stats.propertiesMissingCritical.slice(0, 10).map(prop => {
                  const completeness = calculatePassportCompleteness(prop.passport);
                  return (
                    <Link
                      key={prop.id}
                      to={`/properties/${prop.id}?tab=passport`}
                      className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{prop.address_line_1}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            Missing: {completeness.criticalMissing.slice(0, 3).join(', ')}
                            {completeness.criticalMissing.length > 3 && ` +${completeness.criticalMissing.length - 3} more`}
                          </p>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
                {stats.propertiesMissingCritical.length > 10 && (
                  <p className="text-center text-xs text-muted-foreground pt-2">
                    +{stats.propertiesMissingCritical.length - 10} more properties
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* HMO Licence Details (if any issues) */}
        {(stats.hmoLicences.overdue.length > 0 || stats.hmoLicences.expiringSoon.length > 0) && (
          <Card className="bg-card border-border md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-5 w-5 text-warning" />
                HMO Licence Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {[...stats.hmoLicences.overdue, ...stats.hmoLicences.expiringSoon].map(prop => {
                  const status = getHMOLicenceStatus(prop.passport);
                  const isOverdue = status === 'overdue';
                  return (
                    <Link
                      key={prop.id}
                      to={`/properties/${prop.id}?tab=passport`}
                      className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge 
                            variant="outline" 
                            className={isOverdue ? 'status-danger border' : 'status-warning border'}
                          >
                            {isOverdue ? '🔴' : '🟡'}
                          </Badge>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{prop.address_line_1}</p>
                            <p className="text-xs text-muted-foreground">
                              {isOverdue ? 'Expired' : 'Expiring'}: {formatDateUK(prop.passport?.hmo_licence_expiry)}
                            </p>
                          </div>
                        </div>
                        <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
