import { useMemo, useRef } from 'react';
import { format } from 'date-fns';
import { Printer, Mail, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  useInspection,
  useInspectionItems,
  CONDITION_RATINGS,
  INSPECTION_TYPES,
  type InspectionItem,
  type ConditionRating,
} from '@/hooks/useInspections';

interface InspectionReportProps {
  inspectionId: string;
}

const conditionColor = (condition: ConditionRating | null): string => {
  const rating = CONDITION_RATINGS.find(c => c.value === condition);
  return rating?.color || '';
};

export function InspectionReport({ inspectionId }: InspectionReportProps) {
  const { data: inspection, isLoading: loadingInspection } = useInspection(inspectionId);
  const { data: items = [], isLoading: loadingItems } = useInspectionItems(inspectionId);
  const printRef = useRef<HTMLDivElement>(null);

  // Group items by room
  const roomGroups = useMemo(() => {
    const groups: Record<string, InspectionItem[]> = {};
    for (const item of items) {
      if (!groups[item.room_name]) groups[item.room_name] = [];
      groups[item.room_name].push(item);
    }
    return Object.entries(groups).sort(([, a], [, b]) =>
      (a[0]?.sort_order ?? 0) - (b[0]?.sort_order ?? 0)
    );
  }, [items]);

  // Actions summary
  const actionsRequired = items.filter(i => i.action_required);

  // Condition summary
  const conditionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      if (item.condition && item.condition !== 'n/a') {
        counts[item.condition] = (counts[item.condition] || 0) + 1;
      }
    }
    return counts;
  }, [items]);

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const subject = encodeURIComponent(
      `Inspection Report - ${inspection?.property?.address_line_1 || 'Property'} - ${inspection?.scheduled_date || ''}`
    );
    const body = encodeURIComponent(
      `Please find attached the inspection report for ${inspection?.property?.address_line_1 || 'the property'} dated ${inspection?.scheduled_date || ''}.`
    );
    window.open(`mailto:?subject=${subject}&body=${body}`);
  };

  if (loadingInspection || loadingItems) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading report...
        </CardContent>
      </Card>
    );
  }

  if (!inspection) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Inspection not found.
        </CardContent>
      </Card>
    );
  }

  const inspectionTypeLabel = INSPECTION_TYPES.find(t => t.value === inspection.inspection_type)?.label || inspection.inspection_type;

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2 print:hidden">
        <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
          <Printer className="h-4 w-4" />
          Print / PDF
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleEmail}>
          <Mail className="h-4 w-4" />
          Email Report
        </Button>
      </div>

      {/* Report content */}
      <div ref={printRef} className="space-y-6 print:space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-xl">Property Inspection Report</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {inspectionTypeLabel} Inspection
                </p>
              </div>
              {inspection.overall_condition && (
                <Badge className={cn('text-sm', conditionColor(inspection.overall_condition))}>
                  Overall: {inspection.overall_condition.charAt(0).toUpperCase() + inspection.overall_condition.slice(1)}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Property</p>
                <p className="font-medium">
                  {inspection.property?.address_line_1 || 'N/A'}
                  {inspection.property?.city && `, ${inspection.property.city}`}
                </p>
                {inspection.property?.postcode && (
                  <p className="text-muted-foreground">{inspection.property.postcode}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">
                  {format(new Date(inspection.scheduled_date), 'dd MMM yyyy')}
                </p>
                {inspection.scheduled_time && (
                  <p className="text-muted-foreground">{inspection.scheduled_time}</p>
                )}
              </div>
              <div>
                <p className="text-muted-foreground">Inspector</p>
                <p className="font-medium">{inspection.inspector_name || 'Not specified'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <Badge variant={inspection.status === 'completed' ? 'default' : 'secondary'}>
                  {inspection.status}
                </Badge>
              </div>
            </div>
            {inspection.tenant_present !== null && (
              <div className="mt-3 text-sm">
                <span className="text-muted-foreground">Tenant present: </span>
                <span className="font-medium">{inspection.tenant_present ? 'Yes' : 'No'}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Condition Summary */}
        {Object.keys(conditionCounts).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Condition Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {CONDITION_RATINGS.filter(c => c.value !== 'n/a' && conditionCounts[c.value]).map(c => (
                  <div key={c.value} className={cn('rounded-lg px-4 py-2 text-center', c.color)}>
                    <p className="text-lg font-bold">{conditionCounts[c.value]}</p>
                    <p className="text-xs">{c.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Room-by-room findings */}
        {roomGroups.map(([roomName, roomItems]) => (
          <Card key={roomName}>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{roomName}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {roomItems.map(item => (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{item.item_name}</span>
                      {item.condition && (
                        <Badge className={cn('text-xs', conditionColor(item.condition as ConditionRating))}>
                          {item.condition.charAt(0).toUpperCase() + item.condition.slice(1)}
                        </Badge>
                      )}
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
                    )}
                    {item.action_required && (
                      <div className="flex items-center gap-1 mt-1 text-sm text-orange-600 dark:text-orange-400">
                        <AlertTriangle className="h-3 w-3" />
                        <span>Action: {item.action_description || 'Action required'}</span>
                      </div>
                    )}
                    {item.photos.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {item.photos.map((photo, idx) => (
                          <div key={idx} className="h-20 w-20 rounded-md overflow-hidden border">
                            <img
                              src={photo.url}
                              alt={photo.description || `Photo ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Actions Required Summary */}
        {actionsRequired.length > 0 && (
          <Card className="border-orange-500/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                Actions Required ({actionsRequired.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {actionsRequired.map(item => (
                  <div key={item.id} className="flex items-start gap-2 text-sm">
                    <span className="font-medium text-muted-foreground min-w-[120px]">
                      {item.room_name} &mdash; {item.item_name}
                    </span>
                    <span>{item.action_description || 'Action required'}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary & Signature */}
        {inspection.summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Inspector Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{inspection.summary}</p>
            </CardContent>
          </Card>
        )}

        {/* Follow-up actions */}
        {inspection.follow_up_actions && inspection.follow_up_actions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Follow-Up Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inspection.follow_up_actions.map((action, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-sm rounded-lg border p-3">
                    <Badge variant={
                      action.priority === 'high' ? 'destructive' :
                      action.priority === 'medium' ? 'default' : 'secondary'
                    }>
                      {action.priority}
                    </Badge>
                    <span className="flex-1">{action.description}</span>
                    {action.due_date && (
                      <span className="text-muted-foreground text-xs">
                        Due: {format(new Date(action.due_date), 'dd MMM yyyy')}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <Card>
          <CardContent className="pt-4">
            <Separator className="mb-4" />
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>
                <p>Inspector: <span className="font-medium text-foreground">{inspection.inspector_name || 'N/A'}</span></p>
                {inspection.completed_at && (
                  <p>Completed: {format(new Date(inspection.completed_at), 'dd MMM yyyy, HH:mm')}</p>
                )}
              </div>
              <div className="text-right">
                <p>Report generated by TenureIQ</p>
                <p>{format(new Date(), 'dd MMM yyyy, HH:mm')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
