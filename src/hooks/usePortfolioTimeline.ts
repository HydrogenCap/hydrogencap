import { useMemo } from 'react';
import { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';
import { useActivityLog } from './useActivityLog';
import { usePropertyPassports, type PropertyPassport } from './usePropertyPassport';
import {
  formatGBP,
  getEffectiveCosts,
  calculateMonthlyMortgagePayment,
  calculateROCE,
  calculateNetRent,
} from '@/lib/calculations';

export type TimelineEventType =
  | 'acquisition'
  | 'disposal'
  | 'valuation_milestone'
  | 'mortgage_start'
  | 'refinance'
  | 'rate_change'
  | 'rate_expiry'
  | 'hmo_licence'
  | 'epc_update'
  | 'performance_highlight'
  | 'note';

export type TimelineEventCategory = 'expansion' | 'finance' | 'compliance' | 'performance';

export interface PortfolioSnapshot {
  propertyCount: number;
  totalBeds: number;
  totalValue: number;
  totalMortgage: number;
  equity: number;
  annualCashflow: number;
  averageLTV: number | null;
  weightedROCE: number | null;
}

export interface TimelineEvent {
  id: string;
  date: Date;
  type: TimelineEventType;
  category: TimelineEventCategory;
  title: string;
  subtitle?: string;
  description?: string;
  propertyId?: string;
  propertyAddress?: string;
  metrics?: Record<string, string | number | null>;
  severity?: 'positive' | 'neutral' | 'warning';
  snapshot?: PortfolioSnapshot;
}

export interface TimelineFilters {
  dateRange: 'all' | '12m' | '24m' | 'custom';
  customStart?: Date;
  customEnd?: Date;
  categories: TimelineEventCategory[];
  viewMode: 'gross' | 'attributable';
}

interface UsePortfolioTimelineOptions {
  properties: PropertyWithFinancials[] | undefined;
  filters: TimelineFilters;
}

/**
 * Calculate portfolio snapshot at a given date
 */
function calculateSnapshotAtDate(
  properties: PropertyWithFinancials[],
  asOfDate: Date,
  viewMode: 'gross' | 'attributable'
): PortfolioSnapshot {
  const year = asOfDate.getFullYear();
  
  // Filter to properties acquired before this date
  const activeProperties = properties.filter(p => {
    if (!p.original_purchase_date) return true; // Assume active if no date
    return new Date(p.original_purchase_date) <= asOfDate;
  });

  let totalValue = 0;
  let totalMortgage = 0;
  let totalBeds = 0;
  let totalAnnualCashflow = 0;
  let totalNOI = 0;
  let totalEquityForROCE = 0;

  activeProperties.forEach(property => {
    const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
    const loan = property.loans?.[0];
    const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
    const beds = property.beds ? Number(property.beds) : 0;
    
    const income = property.income?.find(i => i.year === year) || property.income?.[0];
    const costs = property.costs?.find(c => c.year === year) || property.costs?.[0];
    const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;

    const effectiveCosts = getEffectiveCosts(rent, value, costs);
    const mortgagePayment = calculateMonthlyMortgagePayment({
      balance: mortgage || null,
      interestRate: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
      termMonths: loan?.loan_term_months ? Number(loan.loan_term_months) : null,
      isInterestOnly: loan?.capital_or_interest === 'interest',
      paymentOverride: loan?.payment_override_gbp ? Number(loan.payment_override_gbp) : null,
    });

    const annualCashflow = rent !== null
      ? rent - effectiveCosts.total - (mortgagePayment.effective || 0) * 12
      : 0;

    const equity = value - mortgage;
    const noi = rent !== null ? rent - effectiveCosts.total : 0;

    // Apply attribution factor in attributable mode (simplified - uses current ownership)
    const attrFactor = viewMode === 'attributable' 
      ? (property.ownership_percent ? Number(property.ownership_percent) / 100 : 1)
      : 1;

    totalValue += value * attrFactor;
    totalMortgage += mortgage * attrFactor;
    totalBeds += beds;
    totalAnnualCashflow += annualCashflow * attrFactor;
    totalNOI += noi * attrFactor;
    totalEquityForROCE += equity * attrFactor;
  });

  const equity = totalValue - totalMortgage;
  const averageLTV = totalValue > 0 ? (totalMortgage / totalValue) * 100 : null;
  const weightedROCE = totalEquityForROCE > 0 ? (totalNOI / totalEquityForROCE) * 100 : null;

  return {
    propertyCount: activeProperties.length,
    totalBeds,
    totalValue,
    totalMortgage,
    equity,
    annualCashflow: totalAnnualCashflow,
    averageLTV,
    weightedROCE,
  };
}

/**
 * Generate timeline events from property and activity data
 */
export function usePortfolioTimeline({ properties, filters }: UsePortfolioTimelineOptions) {
  const { data: activityData } = useActivityLog();
  const activityLogs = activityData?.items;
  const { data: passports } = usePropertyPassports();

  const events = useMemo(() => {
    if (!properties?.length) return [];

    const timelineEvents: TimelineEvent[] = [];
    const passportMap = new Map<string, PropertyPassport>();
    passports?.forEach(p => passportMap.set(p.property_id, p));

    // ========== A) ACQUISITION EVENTS ==========
    properties.forEach(property => {
      if (property.original_purchase_date) {
        const purchaseDate = new Date(property.original_purchase_date);
        const purchasePrice = property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null;

        timelineEvents.push({
          id: `acq-${property.id}`,
          date: purchaseDate,
          type: 'acquisition',
          category: 'expansion',
          title: 'Property acquired',
          subtitle: property.address_line,
          propertyId: property.id,
          propertyAddress: property.address_line,
          metrics: {
            'Purchase price': purchasePrice ? formatGBP(purchasePrice) : 'Not recorded',
            'Beds': property.beds || '—',
          },
          severity: 'positive',
          snapshot: calculateSnapshotAtDate(properties, purchaseDate, filters.viewMode),
        });
      }
    });

    // ========== B) VALUE MILESTONES ==========
    // Check for significant value milestones (every £500k)
    const milestoneThresholds = [500000, 1000000, 1500000, 2000000, 2500000, 3000000, 4000000, 5000000];
    const currentSnapshot = calculateSnapshotAtDate(properties, new Date(), filters.viewMode);
    
    // Find which milestones have been crossed
    milestoneThresholds.forEach(threshold => {
      if (currentSnapshot.totalValue >= threshold) {
        // Find approximate date when this milestone was crossed
        // For now, use the acquisition date of the property that pushed us over
        const sortedByDate = [...properties]
          .filter(p => p.original_purchase_date)
          .sort((a, b) => new Date(a.original_purchase_date!).getTime() - new Date(b.original_purchase_date!).getTime());

        let runningTotal = 0;
        for (const prop of sortedByDate) {
          runningTotal += prop.current_value_gbp ? Number(prop.current_value_gbp) : 0;
          if (runningTotal >= threshold) {
            const milestoneDate = new Date(prop.original_purchase_date!);
            // Only add if we haven't already added this milestone
            const exists = timelineEvents.some(e => e.id === `val-${threshold}`);
            if (!exists) {
              timelineEvents.push({
                id: `val-${threshold}`,
                date: milestoneDate,
                type: 'valuation_milestone',
                category: 'performance',
                title: `Portfolio value crossed ${formatGBP(threshold)}`,
                severity: 'positive',
                snapshot: calculateSnapshotAtDate(properties, milestoneDate, filters.viewMode),
              });
            }
            break;
          }
        }
      }
    });

    // ========== C) MORTGAGE/FINANCE EVENTS ==========
    properties.forEach(property => {
      const loan = property.loans?.[0];
      if (!loan) return;

      // Mortgage start
      if (loan.loan_start_date) {
        const startDate = new Date(loan.loan_start_date);
        timelineEvents.push({
          id: `mort-start-${property.id}`,
          date: startDate,
          type: 'mortgage_start',
          category: 'finance',
          title: 'Mortgage secured',
          subtitle: property.address_line,
          propertyId: property.id,
          propertyAddress: property.address_line,
          metrics: {
            'Lender': loan.lender || '—',
            'Balance': loan.current_mortgage_balance_gbp ? formatGBP(Number(loan.current_mortgage_balance_gbp)) : '—',
            'Rate': loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—',
          },
          severity: 'neutral',
        });
      }

      // Fixed rate expiry (if in future or recent past)
      if (loan.fixed_rate_expires) {
        const expiryDate = new Date(loan.fixed_rate_expires);
        const now = new Date();
        const daysDiff = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff > -365 && daysDiff < 365) {
          timelineEvents.push({
            id: `rate-exp-${property.id}`,
            date: expiryDate,
            type: 'rate_expiry',
            category: 'finance',
            title: daysDiff < 0 ? 'Fixed rate expired' : 'Fixed rate expiring',
            subtitle: property.address_line,
            propertyId: property.id,
            propertyAddress: property.address_line,
            metrics: {
              'Current rate': loan.interest_rate_percent ? `${loan.interest_rate_percent}%` : '—',
              'Reversion rate': loan.reversion_rate_percent ? `${loan.reversion_rate_percent}%` : 'SVR',
            },
            severity: daysDiff < 0 ? 'warning' : daysDiff < 90 ? 'warning' : 'neutral',
          });
        }
      }
    });

    // ========== D) COMPLIANCE EVENTS ==========
    properties.forEach(property => {
      const passport = passportMap.get(property.id);
      if (!passport) return;

      // HMO Licence
      if (passport.hmo_licence_expiry) {
        const expiryDate = new Date(passport.hmo_licence_expiry);
        const now = new Date();
        
        timelineEvents.push({
          id: `hmo-${property.id}`,
          date: expiryDate,
          type: 'hmo_licence',
          category: 'compliance',
          title: expiryDate < now ? 'HMO licence expired' : 'HMO licence renewal due',
          subtitle: property.address_line,
          propertyId: property.id,
          propertyAddress: property.address_line,
          metrics: {
            'Licence number': passport.hmo_licence_number || '—',
          },
          severity: expiryDate < now ? 'warning' : 'neutral',
        });
      }
    });

    // ========== E) PERFORMANCE HIGHLIGHTS ==========
    // First cashflow positive month (if applicable)
    if (currentSnapshot.annualCashflow > 0) {
      // Estimate when portfolio became cashflow positive
      const sortedAcquisitions = [...properties]
        .filter(p => p.original_purchase_date)
        .sort((a, b) => new Date(a.original_purchase_date!).getTime() - new Date(b.original_purchase_date!).getTime());

      // Find the acquisition that tipped cashflow positive
      for (let i = 0; i < sortedAcquisitions.length; i++) {
        const _propertiesAtPoint = sortedAcquisitions.slice(0, i + 1);
        const pointDate = new Date(sortedAcquisitions[i].original_purchase_date!);
        const snapshot = calculateSnapshotAtDate(properties, pointDate, filters.viewMode);
        
        if (snapshot.annualCashflow > 0) {
          timelineEvents.push({
            id: 'perf-cashflow-positive',
            date: pointDate,
            type: 'performance_highlight',
            category: 'performance',
            title: 'Portfolio became cashflow positive',
            description: `Net annual cashflow: ${formatGBP(snapshot.annualCashflow)}`,
            severity: 'positive',
            snapshot,
          });
          break;
        }
      }
    }

    // Best ROCE achieved
    let bestROCE = 0;
    let bestROCEProperty: PropertyWithFinancials | null = null;
    const currentYear = new Date().getFullYear();

    properties.forEach(property => {
      const value = property.current_value_gbp ? Number(property.current_value_gbp) : 0;
      const loan = property.loans?.[0];
      const mortgage = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
      const income = property.income?.find(i => i.year === currentYear);
      const costs = property.costs?.find(c => c.year === currentYear);
      const rent = income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null;

      const effectiveCosts = getEffectiveCosts(rent, value, costs);
      const equity = value - mortgage;
      const noi = calculateNetRent(rent, effectiveCosts.total);
      const roce = calculateROCE(noi, equity);

      if (roce !== null && roce > bestROCE) {
        bestROCE = roce;
        bestROCEProperty = property;
      }
    });

    if (bestROCEProperty && bestROCE > 10) {
      timelineEvents.push({
        id: 'perf-best-roce',
        date: new Date(),
        type: 'performance_highlight',
        category: 'performance',
        title: 'Top performer by ROCE',
        subtitle: bestROCEProperty.address_line,
        propertyId: bestROCEProperty.id,
        propertyAddress: bestROCEProperty.address_line,
        metrics: {
          'ROCE': `${bestROCE.toFixed(1)}%`,
        },
        severity: 'positive',
      });
    }

    // ========== F) ACTIVITY LOG NOTES ==========
    if (activityLogs?.length) {
      activityLogs
        .filter(log => log.entry_type === 'note_added')
        .forEach(log => {
          timelineEvents.push({
            id: `note-${log.id}`,
            date: new Date(log.created_at),
            type: 'note',
            category: 'performance',
            title: log.title,
            description: log.body || undefined,
            propertyId: log.property_id || undefined,
            severity: 'neutral',
          });
        });
    }

    // Apply date range filter
    let filteredEvents = timelineEvents;
    const now = new Date();

    if (filters.dateRange === '12m') {
      const cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      filteredEvents = filteredEvents.filter(e => e.date >= cutoff);
    } else if (filters.dateRange === '24m') {
      const cutoff = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      filteredEvents = filteredEvents.filter(e => e.date >= cutoff);
    } else if (filters.dateRange === 'custom' && filters.customStart && filters.customEnd) {
      filteredEvents = filteredEvents.filter(
        e => e.date >= filters.customStart! && e.date <= filters.customEnd!
      );
    }

    // Apply category filter
    if (filters.categories.length > 0) {
      filteredEvents = filteredEvents.filter(e => filters.categories.includes(e.category));
    }

    // Sort by date (newest first by default)
    return filteredEvents.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [properties, activityLogs, passports, filters]);

  // Group events by month/year
  const groupedEvents = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    
    events.forEach(event => {
      const key = `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });

    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([key, events]) => ({
        key,
        label: new Date(events[0].date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
        events,
      }));
  }, [events]);

  // Current snapshot
  const currentSnapshot = useMemo(() => {
    if (!properties?.length) return null;
    return calculateSnapshotAtDate(properties, new Date(), filters.viewMode);
  }, [properties, filters.viewMode]);

  return {
    events,
    groupedEvents,
    currentSnapshot,
    totalEvents: events.length,
  };
}

/**
 * Prepare data for AI narrative generation
 */
export function prepareTimelineNarrativeData(
  properties: PropertyWithFinancials[],
  events: TimelineEvent[],
  snapshot: PortfolioSnapshot | null
): string {
  if (!properties.length || !snapshot) return '';

  const acquisitions = events.filter(e => e.type === 'acquisition');
  const milestones = events.filter(e => e.type === 'valuation_milestone');
  const refinances = events.filter(e => e.type === 'refinance' || e.type === 'rate_change');

  const earliestDate = acquisitions.length > 0
    ? acquisitions.reduce((min, e) => e.date < min ? e.date : min, acquisitions[0].date)
    : new Date();

  return `
Portfolio Timeline Summary:
- Properties: ${snapshot.propertyCount}
- Total Beds: ${snapshot.totalBeds}
- Portfolio Value: ${formatGBP(snapshot.totalValue)}
- Total Mortgage: ${formatGBP(snapshot.totalMortgage)}
- Equity: ${formatGBP(snapshot.equity)}
- Annual Cashflow: ${formatGBP(snapshot.annualCashflow)}
- Average LTV: ${snapshot.averageLTV?.toFixed(1) ?? 'N/A'}%
- Weighted ROCE: ${snapshot.weightedROCE?.toFixed(1) ?? 'N/A'}%

Timeline Highlights:
- First acquisition: ${earliestDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
- Total acquisitions: ${acquisitions.length}
- Value milestones crossed: ${milestones.map(m => m.title).join(', ') || 'None yet'}
- Finance events: ${refinances.length}

Recent Events:
${events.slice(0, 10).map(e => `- ${e.date.toLocaleDateString('en-GB')}: ${e.title}${e.subtitle ? ` (${e.subtitle})` : ''}`).join('\n')}
`.trim();
}
