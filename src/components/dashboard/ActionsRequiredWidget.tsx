import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { 
  AlertTriangle, AlertCircle, Calendar, TrendingDown, 
  Shield, FileWarning, ChevronRight, CheckCircle2, ShieldAlert, Building
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { usePortfolioRisks, RiskItem, RiskType, riskTypeLabels } from '@/hooks/usePortfolioRisks';
import { cn } from '@/lib/utils';

const riskIcons: Record<RiskType, React.ElementType> = {
  ltv: AlertTriangle,
  epc: FileWarning,
  rate_expiry: Calendar,
  negative_cashflow: TrendingDown,
  hmo_licence: Shield,
  operational_data: AlertCircle,
  tenancy_compliance: Shield,
  insurance: ShieldAlert,
  leasehold: Building,
};

type ActionCategory = 'all' | 'compliance' | 'financial' | 'data';

const categories: Record<ActionCategory, { label: string; types: RiskType[] }> = {
  all: { label: 'All', types: [] },
  compliance: { label: 'Compliance', types: ['hmo_licence', 'insurance', 'tenancy_compliance'] },
  financial: { label: 'Financial', types: ['ltv', 'rate_expiry', 'negative_cashflow', 'leasehold'] },
  data: { label: 'Data', types: ['epc', 'operational_data'] },
};

function ActionItem({ item }: { item: RiskItem }) {
  const Icon = riskIcons[item.type];
  
  return (
    <Link 
      to={item.targetUrl}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-colors hover:bg-muted/50 group",
        item.severity === 'critical' 
          ? "border-destructive/30 bg-destructive/5" 
          : "border-warning/30 bg-warning/5"
      )}
    >
      <div className={cn(
        "p-2 rounded-full shrink-0",
        item.severity === 'critical' ? "bg-destructive/10" : "bg-warning/10"
      )}>
        <Icon className={cn(
          "h-4 w-4",
          item.severity === 'critical' ? "text-destructive" : "text-warning"
        )} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            item.severity === 'critical' 
              ? "bg-destructive/10 text-destructive" 
              : "bg-warning/10 text-warning"
          )}>
            {riskTypeLabels[item.type]}
          </span>
        </div>
        <p className="font-medium text-sm truncate">{item.address}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{item.message}</p>
      </div>
      
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0 mt-2" />
    </Link>
  );
}

export function ActionsRequiredWidget() {
  const { risks, isLoading, criticalCount, warningCount } = usePortfolioRisks();

  const allActions = useMemo(() => {
    return [...risks].sort((a, b) => {
      if (a.severity !== b.severity) return a.severity === 'critical' ? -1 : 1;
      return a.type.localeCompare(b.type);
    });
  }, [risks]);

  const getFilteredActions = (category: ActionCategory) => {
    if (category === 'all') return allActions;
    return allActions.filter(a => categories[category].types.includes(a.type));
  };

  const totalCount = allActions.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Actions Required</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (totalCount === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            All Clear
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success/50" />
            <p className="font-medium">No actions required</p>
            <p className="text-sm mt-1">Your portfolio is in good shape!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            Actions Required
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive">{criticalCount} critical</Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/30">
                {warningCount} warning
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="all">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
            <TabsTrigger value="compliance">
              Compliance ({getFilteredActions('compliance').length})
            </TabsTrigger>
            <TabsTrigger value="financial">
              Financial ({getFilteredActions('financial').length})
            </TabsTrigger>
            <TabsTrigger value="data">
              Data ({getFilteredActions('data').length})
            </TabsTrigger>
          </TabsList>
          
          {(['all', 'compliance', 'financial', 'data'] as ActionCategory[]).map(cat => (
            <TabsContent key={cat} value={cat}>
              <ScrollArea className="h-[350px] pr-4">
                <div className="space-y-2">
                  {getFilteredActions(cat).length > 0 ? (
                    getFilteredActions(cat).map(item => (
                      <ActionItem key={item.id} item={item} />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-success/50" />
                      <p className="text-sm">No {categories[cat].label.toLowerCase()} actions</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
        
        <div className="mt-4 pt-4 border-t">
          <Button asChild variant="outline" className="w-full">
            <Link to="/actions">
              View All Actions 
              <ChevronRight className="h-4 w-4 ml-2" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
