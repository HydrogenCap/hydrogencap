import { Link } from 'react-router-dom';
import { ChevronRight, Shield, FileWarning } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useMissingCompliance } from '@/hooks/useComplianceRequirements';
import { usePortfolioComplianceStats } from '@/hooks/usePortfolioComplianceStats';
import { getRequirementStatusColor } from '@/lib/complianceRequirements';

export function MissingComplianceWidget() {
  const { stats, isLoading: loadingStats } = usePortfolioComplianceStats();
  const { data: missingItems, isLoading: loadingMissing } = useMissingCompliance();
  
  const isLoading = loadingStats || loadingMissing;
  
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Compliance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }
  
  const totalIssues = stats.expired + stats.expiring;
  const hasIssues = totalIssues > 0;
  
  // Show top 5 issues
  const topIssues = missingItems?.slice(0, 5) || [];
  
  return (
    <Card className={hasIssues ? 'border-red-200 dark:border-red-900/50' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {hasIssues ? (
              <FileWarning className="h-5 w-5 text-red-500" />
            ) : (
              <Shield className="h-5 w-5 text-green-600" />
            )}
            Compliance Overview
          </span>
          {hasIssues && (
            <Badge variant="destructive">
              {totalIssues} issue{totalIssues !== 1 ? 's' : ''}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portfolio compliance score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Portfolio Compliance</span>
            <span className={`font-semibold ${
              stats.total > 0 && stats.valid / stats.total >= 0.8
                ? 'text-green-600' 
                : stats.total > 0 && stats.valid / stats.total >= 0.5
                ? 'text-amber-600' 
                : 'text-red-600'
            }`}>
              {stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 100}%
            </span>
          </div>
          <Progress 
            value={stats.total > 0 ? (stats.valid / stats.total) * 100 : 100} 
            className={`h-2 ${
              stats.total > 0 && stats.valid / stats.total >= 0.8
                ? '[&>div]:bg-green-500' 
                : stats.total > 0 && stats.valid / stats.total >= 0.5
                ? '[&>div]:bg-amber-500' 
                : '[&>div]:bg-red-500'
            }`}
          />
        </div>
        
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-green-100 dark:bg-green-900/20">
            <div className="font-bold text-green-700 dark:text-green-400">{stats.valid}</div>
            <div className="text-green-600 dark:text-green-500">Valid</div>
          </div>
          <div className="p-2 rounded bg-amber-100 dark:bg-amber-900/20">
            <div className="font-bold text-amber-700 dark:text-amber-400">{stats.expiring}</div>
            <div className="text-amber-600 dark:text-amber-500">Expiring</div>
          </div>
          <div className="p-2 rounded bg-red-100 dark:bg-red-900/20">
            <div className="font-bold text-red-700 dark:text-red-400">{stats.expired}</div>
            <div className="text-red-600 dark:text-red-500">Expired / Missing</div>
          </div>
        </div>
        
        {/* Top issues list */}
        {topIssues.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Priority Issues</div>
            {topIssues.map((item, index) => (
              <Link
                key={`${item.propertyId}-${item.requirement.type}-${index}`}
                to={`/properties/${item.propertyId}?tab=compliance`}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors text-sm"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getRequirementStatusColor(item.requirement.status)} text-xs`}>
                      {item.requirement.status === 'missing' 
                        ? 'Missing' 
                        : item.requirement.status === 'expired'
                        ? 'Expired'
                        : 'Expiring'}
                    </Badge>
                    <span className="font-medium truncate">{item.requirement.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.propertyAddress}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
        
        {!hasIssues && (
          <div className="flex items-center gap-3 text-green-600 py-2">
            <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">All Clear</p>
              <p className="text-sm text-muted-foreground">No compliance issues detected</p>
            </div>
          </div>
        )}
        
        <Button variant="outline" size="sm" className="w-full" asChild>
          <Link to="/missing-info?tab=compliance">
            View All Compliance
            <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
