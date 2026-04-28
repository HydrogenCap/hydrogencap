import { useState, useMemo, useCallback } from 'react';
import { addMonths, startOfMonth, endOfMonth, eachDayOfInterval, differenceInDays, isWithinInterval, parseISO } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useAllCompliance } from '@/hooks/useCompliance';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';
import { useCalendarEvents, type CalendarEvent, type CalendarEventType } from '@/hooks/useCalendarEvents';
import { useUpcomingRenewals } from '@/hooks/useComplianceAutoSchedule';
import { getComplianceItemStatus } from '@/lib/complianceTypes';
import type { StatusType } from '@/components/compliance/ComplianceStatusCard';
import { COMPLIANCE_LABELS, type ComplianceEvent } from '../utils/calendarConfig';

export interface RenewalDialogItem {
  id: string;
  property_id: string;
  compliance_type: string;
  expiry_date: string | null;
  propertyAddress: string;
}

export function useComplianceCalendar() {
  const { data: complianceData, isLoading: complianceLoading } = useAllCompliance();
  const complianceItems = complianceData?.items;
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStatus, setSelectedStatus] = useState<StatusType | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [visibleEventTypes, setVisibleEventTypes] = useState<Set<CalendarEventType>>(
    new Set(['compliance', 'job', 'mortgage'])
  );
  const [activeTab, setActiveTab] = useState<string>('calendar');
  const [renewalDialogItem, setRenewalDialogItem] = useState<RenewalDialogItem | null>(null);
  const queryClient = useQueryClient();

  const { events: allCalendarEvents, eventsByDate: unifiedEventsByDate, isLoading: calendarLoading } = useCalendarEvents();
  const { renewalWindowEvents, grouped: renewalGroups } = useUpcomingRenewals(180);

  const isLoading = complianceLoading || propertiesLoading || calendarLoading;

  const propertyMap = useMemo(() => {
    const map = new Map<string, string>();
    properties?.forEach(p => map.set(p.id, p.address_line));
    return map;
  }, [properties]);

  const complianceEvents = useMemo(() => {
    if (!complianceItems?.length) return [];
    const events: ComplianceEvent[] = [];
    const today = new Date();

    complianceItems.forEach(item => {
      if (!item.expiry_date) return;
      const expiryDate = new Date(item.expiry_date);
      const daysUntil = differenceInDays(expiryDate, today);
      const rawStatus = getComplianceItemStatus(item.expiry_date);
      const status: ComplianceEvent['status'] =
        rawStatus === 'expired' ? 'expired' :
        rawStatus === 'expiring_soon' ? 'expiring_soon' :
        rawStatus === 'valid' ? 'valid' : 'missing';
      const address = propertyMap.get(item.property_id) || 'Unknown Property';

      events.push({
        id: item.id,
        propertyId: item.property_id,
        address,
        date: expiryDate,
        type: item.compliance_type,
        typeLabel: COMPLIANCE_LABELS[item.compliance_type] || item.compliance_type,
        daysUntil,
        status,
        issueDate: item.issue_date,
      });
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [complianceItems, propertyMap]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();
  const paddedDays = Array(firstDayOfWeek).fill(null).concat(calendarDays);

  const filteredEventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    unifiedEventsByDate.forEach((events, dateKey) => {
      const filtered = events.filter(e => visibleEventTypes.has(e.eventType));
      if (filtered.length > 0) {
        map.set(dateKey, filtered);
      }
    });
    return map;
  }, [unifiedEventsByDate, visibleEventTypes]);

  const upcomingEvents = useMemo<CalendarEvent[]>(() => {
    const cutoff = addMonths(new Date(), 12);
    const now = new Date();
    return allCalendarEvents
      .filter(e => e.date >= now && e.date <= cutoff && visibleEventTypes.has(e.eventType))
      .slice(0, 50);
  }, [allCalendarEvents, visibleEventTypes]);

  const stats = useMemo(() => {
    const expired = complianceEvents.filter(e => e.status === 'expired');
    const within30 = complianceEvents.filter(e => e.daysUntil >= 0 && e.daysUntil <= 30);
    const within90 = complianceEvents.filter(e => e.daysUntil > 30 && e.daysUntil <= 90);
    const valid = complianceEvents.filter(e => e.daysUntil > 90);
    return { expired, within30, within90, valid, all: complianceEvents };
  }, [complianceEvents]);

  const filteredItems = useMemo(() => {
    if (!selectedStatus) return [];
    switch (selectedStatus) {
      case 'expired': return stats.expired;
      case 'expiring_soon': return stats.within30;
      case 'within_90': return stats.within90;
      case 'valid': return stats.valid;
      case 'all': return stats.all;
      default: return [];
    }
  }, [selectedStatus, stats]);

  const handleStatusClick = useCallback((status: StatusType) => {
    setSelectedStatus(status);
    setDrawerOpen(true);
  }, []);

  const handleItemUpdated = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
  }, [queryClient]);

  const navigateMonth = (delta: number) => {
    setCurrentMonth(prev => addMonths(prev, delta));
  };

  const toggleEventType = (type: CalendarEventType) => {
    const newTypes = new Set(visibleEventTypes);
    if (newTypes.has(type)) newTypes.delete(type);
    else newTypes.add(type);
    setVisibleEventTypes(newTypes);
  };

  const isInRenewalWindow = useCallback((day: Date) => {
    return renewalWindowEvents.some(rw => {
      const start = parseISO(rw.windowStart);
      const end = parseISO(rw.windowEnd);
      return isWithinInterval(day, { start, end });
    });
  }, [renewalWindowEvents]);

  const handleExpiryClick = useCallback((event: CalendarEvent) => {
    if (event.eventType !== 'compliance') return;
    const item = complianceItems?.find(ci => `compliance-${ci.id}` === event.id);
    if (!item) return;
    setRenewalDialogItem({
      id: item.id,
      property_id: item.property_id,
      compliance_type: item.compliance_type,
      expiry_date: item.expiry_date,
      propertyAddress: event.propertyAddress,
    });
  }, [complianceItems]);

  const handleRenewalComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['compliance', 'all'] });
    queryClient.invalidateQueries({ queryKey: ['contractor-jobs'] });
    setRenewalDialogItem(null);
  }, [queryClient]);

  const renewalQueueCount = (renewalGroups?.overdue.length ?? 0) + (renewalGroups?.thisMonth.length ?? 0);

  return {
    isLoading,
    currentMonth, setCurrentMonth,
    selectedStatus,
    drawerOpen, setDrawerOpen,
    visibleEventTypes,
    activeTab, setActiveTab,
    renewalDialogItem, setRenewalDialogItem,
    paddedDays,
    filteredEventsByDate,
    upcomingEvents,
    stats,
    filteredItems,
    handleStatusClick,
    handleItemUpdated,
    navigateMonth,
    toggleEventType,
    isInRenewalWindow,
    handleExpiryClick,
    handleRenewalComplete,
    renewalQueueCount,
  };
}
