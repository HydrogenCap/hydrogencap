import { useMemo } from 'react';
import { differenceInDays, addMonths, format } from 'date-fns';
import { useAllCompliance } from '@/hooks/useCompliance';
import { usePropertiesCompat as useProperties } from '@/hooks/usePropertiesCompat';

// Optimal renewal windows — months before expiry to start the renewal process
// Gas Safety: book at 10 months (landlord keeps anniversary date if renewed within last 2 months)
// EICR: book at 4 years 9 months
// EPC: book at 9 years
// HMO Licence: book at 4 years 9 months (council-dependent)
// Fire Risk Assessment: annual review suggested
const RENEWAL_WINDOW_CONFIG: Record<string, {
  windowMonthsBefore: number;
  validityMonths: number;
  label: string;
  description: string;
}> = {
  GAS_SAFETY: {
    windowMonthsBefore: 2,
    validityMonths: 12,
    label: 'Gas Safety (CP12)',
    description: 'Book at 10 months — landlord keeps anniversary date if renewed within last 2 months',
  },
  EICR: {
    windowMonthsBefore: 3,
    validityMonths: 60,
    label: 'EICR',
    description: 'Book at 4 years 9 months',
  },
  EPC: {
    windowMonthsBefore: 12,
    validityMonths: 120,
    label: 'EPC',
    description: 'Book at 9 years',
  },
  HMO_LICENCE: {
    windowMonthsBefore: 3,
    validityMonths: 60,
    label: 'HMO Licence',
    description: 'Book at 4 years 9 months or per council requirement',
  },
  FIRE_ALARM: {
    windowMonthsBefore: 2,
    validityMonths: 12,
    label: 'Fire Alarm',
    description: 'Annual review — suggest booking 2 months before expiry',
  },
  EMERGENCY_LIGHTING: {
    windowMonthsBefore: 2,
    validityMonths: 12,
    label: 'Emergency Lighting',
    description: 'Annual review — suggest booking 2 months before expiry',
  },
  LEGIONELLA: {
    windowMonthsBefore: 3,
    validityMonths: 24,
    label: 'Legionella',
    description: 'Book at 21 months',
  },
  PAT_TESTING: {
    windowMonthsBefore: 2,
    validityMonths: 12,
    label: 'PAT Testing',
    description: 'Annual — suggest booking 2 months before expiry',
  },
};

// Default reminder intervals (days before expiry)
const DEFAULT_REMINDER_INTERVALS = [90, 60, 30];

export interface RenewalWindowItem {
  complianceItemId: string;
  propertyId: string;
  propertyAddress: string;
  complianceType: string;
  complianceLabel: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  renewalWindowOpens: Date;
  daysUntilWindowOpens: number;
  isInRenewalWindow: boolean;
  isOverdue: boolean;
  renewalStatus: string | null;
  contractorId: string | null;
  windowMonthsBefore: number;
  validityMonths: number;
}

export interface AutoScheduleReminder {
  complianceItemId: string;
  propertyId: string;
  propertyAddress: string;
  complianceType: string;
  expiryDate: Date;
  reminderDate: Date;
  daysBefore: number;
  label: string;
}

const COMPLIANCE_LABELS: Record<string, string> = {
  GAS_SAFETY: 'Gas Safety',
  EICR: 'EICR',
  EPC: 'EPC',
  HMO_LICENCE: 'HMO Licence',
  FIRE_ALARM: 'Fire Alarm',
  EMERGENCY_LIGHTING: 'Emergency Lighting',
  LEGIONELLA: 'Legionella',
  PAT_TESTING: 'PAT Testing',
};

export function useAutoScheduleConfig() {
  return useMemo(() => ({
    renewalWindows: RENEWAL_WINDOW_CONFIG,
    reminderIntervals: DEFAULT_REMINDER_INTERVALS,
  }), []);
}

export function useUpcomingRenewals(days: number = 90) {
  const { data: complianceData, isLoading: complianceLoading } = useAllCompliance();
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const complianceItems = useMemo(() => complianceData?.items, [complianceData]);

  const isLoading = complianceLoading || propertiesLoading;

  const propertyMap = useMemo(() => {
    const map: Record<string, string> = {};
    properties?.forEach(p => { map[p.id] = p.address_line; });
    return map;
  }, [properties]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- React Compiler bails on this complex derivation; manual memo is correct and safe
  const renewals = useMemo<RenewalWindowItem[]>(() => {
    if (!complianceItems?.length) return [];

    const today = new Date();

    const mapped: RenewalWindowItem[] = complianceItems
      .filter(item => !!item.expiry_date)
      .map(item => {
        const expiryDate = new Date(item.expiry_date as string);
        const daysUntilExpiry = differenceInDays(expiryDate, today);
        const config = RENEWAL_WINDOW_CONFIG[item.compliance_type];
        const windowMonthsBefore = config?.windowMonthsBefore ?? 2;
        const validityMonths = config?.validityMonths ?? 12;
        const renewalWindowOpens = addMonths(expiryDate, -windowMonthsBefore);
        const daysUntilWindowOpens = differenceInDays(renewalWindowOpens, today);
        const isInRenewalWindow = today >= renewalWindowOpens;
        const isOverdue = daysUntilExpiry < 0;
        return {
          complianceItemId: item.id,
          propertyId: item.property_id,
          propertyAddress: propertyMap[item.property_id] || 'Unknown Property',
          complianceType: item.compliance_type,
          complianceLabel: COMPLIANCE_LABELS[item.compliance_type] || item.compliance_type,
          expiryDate,
          daysUntilExpiry,
          renewalWindowOpens,
          daysUntilWindowOpens,
          isInRenewalWindow,
          isOverdue,
          renewalStatus: item.renewal_status ?? null,
          contractorId: item.renewal_contractor_id ?? null,
          windowMonthsBefore,
          validityMonths,
        };
      })
      .filter(r => r.daysUntilExpiry <= days || r.isOverdue);

    // Sort: overdue first, then by days until expiry (return a new array — do not mutate)
    return [...mapped].sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.daysUntilExpiry - b.daysUntilExpiry;
    });
  }, [complianceItems, propertyMap, days]);

  // Group by urgency
  const grouped = useMemo(() => {
    const overdue = renewals.filter(r => r.isOverdue);
    const thisMonth = renewals.filter(r => !r.isOverdue && r.daysUntilExpiry <= 30);
    const next3Months = renewals.filter(r => !r.isOverdue && r.daysUntilExpiry > 30 && r.daysUntilExpiry <= 90);
    const scheduled = renewals.filter(r =>
      !r.isOverdue && r.renewalStatus && ['booked', 'confirmed'].includes(r.renewalStatus)
    );

    return { overdue, thisMonth, next3Months, scheduled, all: renewals };
  }, [renewals]);

  // Generate auto-schedule reminders
  const reminders = useMemo<AutoScheduleReminder[]>(() => {
    if (!complianceItems?.length) return [];

    const today = new Date();
    const reminderList: AutoScheduleReminder[] = [];

    complianceItems.forEach(item => {
      if (!item.expiry_date) return;

      const expiryDate = new Date(item.expiry_date);

      DEFAULT_REMINDER_INTERVALS.forEach(daysBefore => {
        const reminderDate = new Date(expiryDate);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);

        // Only include future reminders (or reminders from today)
        if (reminderDate >= today) {
          reminderList.push({
            complianceItemId: item.id,
            propertyId: item.property_id,
            propertyAddress: propertyMap[item.property_id] || 'Unknown Property',
            complianceType: item.compliance_type,
            expiryDate,
            reminderDate,
            daysBefore,
            label: `${daysBefore}-day reminder: ${COMPLIANCE_LABELS[item.compliance_type] || item.compliance_type}`,
          });
        }
      });
    });

    return reminderList.sort((a, b) => a.reminderDate.getTime() - b.reminderDate.getTime());
  }, [complianceItems, propertyMap]);

  // Renewal window events for calendar overlay
  const renewalWindowEvents = useMemo(() => {
    return renewals
      .filter(r => !r.isOverdue && r.daysUntilExpiry > 0)
      .map(r => ({
        complianceItemId: r.complianceItemId,
        propertyId: r.propertyId,
        complianceType: r.complianceType,
        windowStart: format(r.renewalWindowOpens, 'yyyy-MM-dd'),
        windowEnd: format(r.expiryDate, 'yyyy-MM-dd'),
        isInWindow: r.isInRenewalWindow,
      }));
  }, [renewals]);

  return {
    renewals,
    grouped,
    reminders,
    renewalWindowEvents,
    isLoading,
  };
}
