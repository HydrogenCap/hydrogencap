import { useState, useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday } from 'date-fns';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, AlertTriangle, Bell } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  useInspections,
  useCreateInspection,
  INSPECTION_TYPES,
  type InspectionType,
} from '@/hooks/useInspections';
import { usePropertiesV2, type PropertyWithEntity } from '@/hooks/usePropertiesV2';

interface ScheduleFormData {
  property_id: string;
  inspection_type: InspectionType;
  scheduled_date: string;
  scheduled_time: string;
  inspector_name: string;
  tenant_notified: boolean;
  access_notes: string;
  recurring_months: number | null;
}

const INITIAL_FORM: ScheduleFormData = {
  property_id: '',
  inspection_type: 'periodic',
  scheduled_date: format(new Date(), 'yyyy-MM-dd'),
  scheduled_time: '10:00',
  inspector_name: '',
  tenant_notified: false,
  access_notes: '',
  recurring_months: null,
};

export function InspectionScheduler() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [form, setForm] = useState<ScheduleFormData>(INITIAL_FORM);

  const { data: inspections = [] } = useInspections();
  const { data: properties = [] } = usePropertiesV2();
  const createInspection = useCreateInspection();

  // Properties not inspected in 6+ months
  const overdueProperties = useMemo(() => {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    return properties.filter(prop => {
      const lastInspection = inspections
        .filter(i => i.property_id === prop.id && i.status === 'completed')
        .sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date))[0];
      return !lastInspection || parseISO(lastInspection.scheduled_date) < sixMonthsAgo;
    });
  }, [properties, inspections]);

  // Calendar data
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Pad start to Monday
  const startDayOfWeek = monthStart.getDay();
  const paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const inspectionsForDay = (day: Date) =>
    inspections.filter(i => isSameDay(parseISO(i.scheduled_date), day));

  const handleSubmit = async () => {
    if (!form.property_id || !form.scheduled_date) return;

    const payload = {
      property_id: form.property_id,
      inspection_type: form.inspection_type,
      scheduled_date: form.scheduled_date,
      scheduled_time: form.scheduled_time || null,
      inspector_name: form.inspector_name || null,
      tenant_notified: form.tenant_notified,
      access_notes: form.access_notes || null,
    };

    await createInspection.mutateAsync(payload);

    // Schedule recurring inspections
    if (form.recurring_months) {
      const baseDate = parseISO(form.scheduled_date);
      for (let i = 1; i <= 3; i++) {
        const nextDate = addMonths(baseDate, form.recurring_months * i);
        await createInspection.mutateAsync({
          ...payload,
          scheduled_date: format(nextDate, 'yyyy-MM-dd'),
        });
      }
    }

    setShowScheduleDialog(false);
    setForm(INITIAL_FORM);
  };

  const handleScheduleOverdue = (property: PropertyWithEntity) => {
    setForm({
      ...INITIAL_FORM,
      property_id: property.id,
      scheduled_date: format(addMonths(new Date(), 0), 'yyyy-MM-dd'),
    });
    setShowScheduleDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Inspection Schedule</h2>
          <p className="text-sm text-muted-foreground">
            {inspections.filter(i => i.status === 'scheduled').length} upcoming inspections
          </p>
        </div>
        <Button onClick={() => setShowScheduleDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Schedule Inspection
        </Button>
      </div>

      {/* Overdue Properties Alert */}
      {overdueProperties.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-50 dark:bg-orange-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              {overdueProperties.length} properties not inspected in 6+ months
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {overdueProperties.slice(0, 5).map(prop => (
                <Button
                  key={prop.id}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleScheduleOverdue(prop)}
                >
                  {prop.address_line_1}
                </Button>
              ))}
              {overdueProperties.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{overdueProperties.length - 5} more
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-sm font-medium">{format(currentMonth, 'MMMM yyyy')}</h3>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-px">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} className="p-2 text-center text-xs font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {/* Padding for start of month */}
            {Array.from({ length: paddingDays }).map((_, i) => (
              <div key={`pad-${i}`} className="min-h-[80px] p-1" />
            ))}
            {calendarDays.map(day => {
              const dayInspections = inspectionsForDay(day);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    'min-h-[80px] rounded-md border p-1 text-xs',
                    !isSameMonth(day, currentMonth) && 'opacity-40',
                    isToday(day) && 'border-primary bg-primary/5',
                  )}
                >
                  <div className="font-medium">{format(day, 'd')}</div>
                  <div className="mt-1 space-y-0.5">
                    {dayInspections.slice(0, 3).map(insp => (
                      <div
                        key={insp.id}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-[10px] font-medium',
                          insp.status === 'completed' && 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
                          insp.status === 'scheduled' && 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                          insp.status === 'in_progress' && 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
                          insp.status === 'cancelled' && 'bg-muted text-muted-foreground line-through',
                        )}
                      >
                        {insp.property?.address_line_1 || 'Inspection'}
                      </div>
                    ))}
                    {dayInspections.length > 3 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{dayInspections.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Schedule Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Schedule Inspection
            </DialogTitle>
            <DialogDescription>
              Book an upcoming property inspection and assign it to the right team member.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property</Label>
              <Select value={form.property_id} onValueChange={v => setForm(f => ({ ...f, property_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address_line_1}, {p.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Inspection Type</Label>
              <Select value={form.inspection_type} onValueChange={v => setForm(f => ({ ...f, inspection_type: v as InspectionType }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSPECTION_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.scheduled_date}
                  onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Time</Label>
                <Input
                  type="time"
                  value={form.scheduled_time}
                  onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Inspector Name</Label>
              <Input
                placeholder="Enter inspector name"
                value={form.inspector_name}
                onChange={e => setForm(f => ({ ...f, inspector_name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Recurring</Label>
              <Select
                value={form.recurring_months?.toString() || 'none'}
                onValueChange={v => setForm(f => ({ ...f, recurring_months: v === 'none' ? null : parseInt(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">One-off</SelectItem>
                  <SelectItem value="3">Every 3 months</SelectItem>
                  <SelectItem value="6">Every 6 months</SelectItem>
                  <SelectItem value="12">Every 12 months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Notify Tenant</p>
                  <p className="text-xs text-muted-foreground">Send notification via tenant portal</p>
                </div>
              </div>
              <Switch
                checked={form.tenant_notified}
                onCheckedChange={v => setForm(f => ({ ...f, tenant_notified: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Access Notes</Label>
              <Textarea
                placeholder="Key safe code, access arrangements..."
                value={form.access_notes}
                onChange={e => setForm(f => ({ ...f, access_notes: e.target.value }))}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!form.property_id || !form.scheduled_date || createInspection.isPending}
              >
                {createInspection.isPending ? 'Scheduling...' : 'Schedule'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
