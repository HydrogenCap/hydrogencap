/**
 * Tenancy Lifecycle Event Engine (AA4a)
 * Calculates actionable events from tenancy data: end dates, break clauses, rent reviews, voids.
 */
import { differenceInDays, addMonths, addYears, isBefore, isAfter } from 'date-fns';

export interface TenancyEvent {
  tenancyId: string;
  type: 'tenancy_end' | 'break_clause' | 'rent_review' | 'void_start';
  date: string;
  daysUntil: number;
  status: 'upcoming' | 'action_required' | 'overdue';
  title: string;
  description: string;
  propertyAddress: string;
  tenantName: string;
  roomName: string;
  propertyId: string;
}

interface TenancyRow {
  id: string;
  start_date: string;
  initial_end_date: string | null;
  actual_end_date: string | null;
  break_clause_date: string | null;
  last_rent_review_date: string | null;
  status: string;
  rent_amount_pcm: number;
  is_periodic: boolean | null;
  tenant: { first_name: string; last_name: string } | null;
  room: { room_name: string; property: { id: string; address_line_1: string; city: string | null; postcode: string | null } | null } | null;
}

/**
 * Calculate all lifecycle events from a set of tenancies
 */
export function calculateAllEvents(tenancies: TenancyRow[] | null, daysAhead: number = 90): TenancyEvent[] {
  if (!tenancies?.length) return [];
  
  const now = new Date();
  const events: TenancyEvent[] = [];

  for (const t of tenancies) {
    const tenantName = t.tenant ? `${t.tenant.first_name} ${t.tenant.last_name}`.trim() : 'Unknown';
    const roomName = t.room?.room_name || 'Unknown Room';
    const prop = t.room?.property;
    const propertyAddress = prop 
      ? `${prop.address_line_1}${prop.city ? `, ${prop.city}` : ''}`
      : 'Unknown Property';
    const propertyId = prop?.id || '';

    // 1. Tenancy end date
    const endDateStr = t.actual_end_date || t.initial_end_date;
    if (endDateStr) {
      const endDate = new Date(endDateStr);
      const daysUntil = differenceInDays(endDate, now);
      
      if (daysUntil <= daysAhead) {
        events.push({
          tenancyId: t.id,
          type: 'tenancy_end',
          date: endDateStr,
          daysUntil,
          status: daysUntil < 0 ? 'overdue' : daysUntil <= 60 ? 'action_required' : 'upcoming',
          title: 'Tenancy ends',
          description: daysUntil < 0 
            ? `Tenancy ended ${Math.abs(daysUntil)} days ago — decide on renewal or void`
            : `Tenancy ends in ${daysUntil} days`,
          propertyAddress,
          tenantName,
          roomName,
          propertyId,
        });
      }
    }

    // 2. Break clause
    if (t.break_clause_date) {
      const breakDate = new Date(t.break_clause_date);
      // Notice deadline = 2 months before break date
      const noticeDeadline = addMonths(breakDate, -2);
      const daysUntilNotice = differenceInDays(noticeDeadline, now);

      if (daysUntilNotice <= daysAhead) {
        events.push({
          tenancyId: t.id,
          type: 'break_clause',
          date: noticeDeadline.toISOString().substring(0, 10),
          daysUntil: daysUntilNotice,
          status: daysUntilNotice < 0 ? 'overdue' : daysUntilNotice <= 60 ? 'action_required' : 'upcoming',
          title: 'Break clause notice deadline',
          description: daysUntilNotice < 0
            ? `Notice deadline passed ${Math.abs(daysUntilNotice)} days ago (break date: ${t.break_clause_date})`
            : `Notice must be served in ${daysUntilNotice} days (break date: ${t.break_clause_date})`,
          propertyAddress,
          tenantName,
          roomName,
          propertyId,
        });
      }
    }

    // 3. Rent review — next anniversary of start_date
    if (t.status === 'active' || t.status === 'periodic') {
      const startDate = new Date(t.start_date);
      let nextReview: Date;

      if (t.last_rent_review_date) {
        // Next review = 1 year after last review
        nextReview = addYears(new Date(t.last_rent_review_date), 1);
      } else {
        // Next review = first anniversary of start date that's in the future
        nextReview = addYears(startDate, 1);
        while (isBefore(nextReview, now)) {
          nextReview = addYears(nextReview, 1);
        }
      }

      const daysUntil = differenceInDays(nextReview, now);
      if (daysUntil <= daysAhead && daysUntil >= -30) {
        events.push({
          tenancyId: t.id,
          type: 'rent_review',
          date: nextReview.toISOString().substring(0, 10),
          daysUntil,
          status: daysUntil < 0 ? 'overdue' : daysUntil <= 60 ? 'action_required' : 'upcoming',
          title: 'Rent review due',
          description: daysUntil < 0
            ? `Rent review was due ${Math.abs(daysUntil)} days ago`
            : `Rent review due in ${daysUntil} days`,
          propertyAddress,
          tenantName,
          roomName,
          propertyId,
        });
      }
    }
  }

  // Sort: overdue first, then by date ascending
  return events.sort((a, b) => {
    if (a.status === 'overdue' && b.status !== 'overdue') return -1;
    if (b.status === 'overdue' && a.status !== 'overdue') return 1;
    return a.daysUntil - b.daysUntil;
  });
}
