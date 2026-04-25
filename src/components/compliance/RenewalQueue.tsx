import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import {
  AlertTriangle, Calendar, Clock, ChevronDown, ChevronRight,
  Flame, Zap, Home, Building2, Shield, PlayCircle, Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { SEVERITY } from '@/lib/design-tokens';
import { useUpcomingRenewals, type RenewalWindowItem } from '@/hooks/useComplianceAutoSchedule';
import { useContractors } from '@/hooks/useContractors';
import { RenewalWorkflowDialog } from './RenewalWorkflowDialog';

const COMPLIANCE_ICONS: Record<string, React.ElementType> = {
  GAS_SAFETY: Flame,
  EICR: Zap,
  EPC: Home,
  HMO_LICENCE: Building2,
  FIRE_ALARM: Shield,
  EMERGENCY_LIGHTING: Shield,
  LEGIONELLA: Shield,
  PAT_TESTING: Zap,
};

interface RenewalGroupProps {
  title: string;
  items: RenewalWindowItem[];
  severity: keyof typeof SEVERITY;
  icon: React.ElementType;
  defaultOpen?: boolean;
  onStartRenewal: (item: RenewalWindowItem) => void;
}

function RenewalGroup({ title, items, severity, icon: Icon, defaultOpen = false, onStartRenewal }: RenewalGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const colors = SEVERITY[severity];

  if (items.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full text-left py-2 px-1 hover:bg-muted/50 rounded transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className={cn('h-4 w-4', colors.text)} />
        <span className="font-medium text-sm">{title}</span>
        <Badge className={cn('ml-auto text-xs', colors.badge)}>{items.length}</Badge>
      </button>

      {isOpen && (
        <div className="space-y-2 pl-2 mt-1">
          {items.map(item => {
            const CertIcon = COMPLIANCE_ICONS[item.complianceType] || Shield;
            return (
              <div
                key={item.complianceItemId}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
              >
                <div className={cn('p-1.5 rounded', colors.bg)}>
                  <CertIcon className={cn('h-3.5 w-3.5', colors.text)} />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.propertyAddress.split(',')[0]}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">{item.complianceLabel}</span>
                    <span className="text-xs text-muted-foreground">&middot;</span>
                    <span className="text-xs text-muted-foreground">
                      {format(item.expiryDate, 'dd MMM yyyy')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {item.renewalStatus && ['booked', 'confirmed'].includes(item.renewalStatus) ? (
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      {item.renewalStatus === 'booked' ? 'Booked' : 'Confirmed'}
                    </Badge>
                  ) : (
                    <Badge
                      variant={item.isOverdue ? 'destructive' : 'secondary'}
                      className="text-xs"
                    >
                      {item.isOverdue
                        ? `${Math.abs(item.daysUntilExpiry)}d overdue`
                        : `${item.daysUntilExpiry}d left`}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onStartRenewal(item)}
                    className="text-xs h-7"
                  >
                    <PlayCircle className="h-3.5 w-3.5 mr-1" />
                    Start
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RenewalQueue() {
  const { grouped, isLoading } = useUpcomingRenewals(180);
  const [renewalTarget, setRenewalTarget] = useState<RenewalWindowItem | null>(null);
  const [bulkType, setBulkType] = useState<string>('');
  const [bulkContractor, setBulkContractor] = useState<string>('');

  // Get all unique compliance types from the queue for bulk actions
  const complianceTypes = useMemo(() => {
    const types = new Set<string>();
    grouped.all.forEach(item => types.add(item.complianceType));
    return Array.from(types);
  }, [grouped.all]);

  const { data: contractors } = useContractors({ isActive: true });

  const handleStartRenewal = (item: RenewalWindowItem) => {
    setRenewalTarget(item);
  };

  // Filter out 'scheduled' items from their original groups to avoid double-counting
  const overdueItems = useMemo(() =>
    grouped.overdue.filter(r => !r.renewalStatus || !['booked', 'confirmed'].includes(r.renewalStatus)),
    [grouped.overdue]
  );
  const thisMonthItems = useMemo(() =>
    grouped.thisMonth.filter(r => !r.renewalStatus || !['booked', 'confirmed'].includes(r.renewalStatus)),
    [grouped.thisMonth]
  );
  const next3MonthsItems = useMemo(() =>
    grouped.next3Months.filter(r => !r.renewalStatus || !['booked', 'confirmed'].includes(r.renewalStatus)),
    [grouped.next3Months]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">Loading renewal queue...</p>
        </CardContent>
      </Card>
    );
  }

  const totalItems = grouped.all.length;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Renewal Queue
              </CardTitle>
              <CardDescription>
                {totalItems} certificate{totalItems !== 1 ? 's' : ''} due for renewal
              </CardDescription>
            </div>
          </div>

          {/* Bulk Actions */}
          {totalItems > 0 && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <span className="text-xs text-muted-foreground shrink-0">Bulk book:</span>
              <Select value={bulkType} onValueChange={setBulkType}>
                <SelectTrigger className="h-7 text-xs w-[140px]">
                  <SelectValue placeholder="Cert type..." />
                </SelectTrigger>
                <SelectContent>
                  {complianceTypes.map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{t.replace(/_/g, ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">with</span>
              <Select value={bulkContractor} onValueChange={setBulkContractor}>
                <SelectTrigger className="h-7 text-xs w-[140px]">
                  <SelectValue placeholder="Contractor..." />
                </SelectTrigger>
                <SelectContent>
                  {contractors?.map(c => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={!bulkType || !bulkContractor}
              >
                <Users className="h-3 w-3 mr-1" />
                Book All
              </Button>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <div className="space-y-1 p-4 pt-0">
              {totalItems === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="mx-auto h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">No upcoming renewals</p>
                </div>
              ) : (
                <>
                  <RenewalGroup
                    title="Overdue"
                    items={overdueItems}
                    severity="critical"
                    icon={AlertTriangle}
                    defaultOpen={true}
                    onStartRenewal={handleStartRenewal}
                  />
                  <RenewalGroup
                    title="This Month"
                    items={thisMonthItems}
                    severity="warning"
                    icon={Clock}
                    defaultOpen={true}
                    onStartRenewal={handleStartRenewal}
                  />
                  <RenewalGroup
                    title="Next 3 Months"
                    items={next3MonthsItems}
                    severity="info"
                    icon={Calendar}
                    defaultOpen={false}
                    onStartRenewal={handleStartRenewal}
                  />
                  <RenewalGroup
                    title="Scheduled"
                    items={grouped.scheduled}
                    severity="success"
                    icon={Calendar}
                    defaultOpen={false}
                    onStartRenewal={handleStartRenewal}
                  />
                </>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Renewal Workflow Dialog */}
      {renewalTarget && (
        <RenewalWorkflowDialog
          open={!!renewalTarget}
          onOpenChange={(open) => { if (!open) setRenewalTarget(null); }}
          complianceItem={{
            id: renewalTarget.complianceItemId,
            property_id: renewalTarget.propertyId,
            compliance_type: renewalTarget.complianceType,
            expiry_date: renewalTarget.expiryDate.toISOString(),
          }}
          propertyAddress={renewalTarget.propertyAddress}
          onComplete={() => setRenewalTarget(null)}
        />
      )}
    </>
  );
}
