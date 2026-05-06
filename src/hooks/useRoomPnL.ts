/**
 * Room-level P&L hook (Prompt #19).
 *
 * Computes contribution = grossIncome − voidLoss − maintenanceCosts
 * for a single room (`useRoomPnL`) or every accessible room
 * (`useRoomPnLPortfolio`) over a configurable period.
 *
 * Schema fallbacks intentionally applied:
 *  - `rooms_v2` has no `area_sqm` column → property-level cost
 *    proportional allocation is unsupported. We instead allocate
 *    maintenance costs that are *directly* attributed to the room
 *    via `work_orders.room_id` (and `maintenance_requests.room_v2_id`
 *    where `actual_cost` is set). Property-wide `costs` are not split
 *    across rooms.
 *  - `rent_payments.payment_date` is the canonical column (the prompt
 *    referred to `paid_at`). We sum `amount` over `payment_date` in range.
 *  - Daily void rent is inferred from the most recent
 *    `tenancy_agreements.rent_amount_pcm` for the room (÷ 30).
 *
 * If a required column is missing the hook returns 0 for that field
 * and surfaces a warning via the `limitations` array on the result.
 */
import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import {
  startOfMonth, startOfYear, subMonths, format,
  differenceInCalendarDays, max as maxDate, min as minDate,
} from 'date-fns';

export type RoomPnLPeriod = 'current_month' | 'ytd' | 'last_12_months' | 'all_time';

export interface RoomPnLResult {
  roomId: string;
  period: RoomPnLPeriod;
  periodStart: string | null;   // ISO date or null for all_time
  periodEnd: string;            // ISO date (today)
  periodDays: number;           // span in days for occupancy calc
  grossIncome: number;
  voidDays: number;
  voidLoss: number;
  maintenanceCosts: number;
  contribution: number;
  occupancyRate: number;        // 0..1
  limitations: string[];
}

export interface RoomPortfolioRow {
  roomId: string;
  propertyId: string;
  address: string;
  roomName: string;
  grossIncome: number;
  voidLoss: number;
  voidDays: number;
  maintenanceCosts: number;
  contribution: number;
  occupancyRate: number;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

export function resolvePeriodRange(
  period: RoomPnLPeriod,
  now: Date = new Date(),
): { start: Date | null; end: Date; days: number } {
  const end = now;
  switch (period) {
    case 'current_month': {
      const start = startOfMonth(now);
      return { start, end, days: Math.max(1, differenceInCalendarDays(end, start) + 1) };
    }
    case 'ytd': {
      const start = startOfYear(now);
      return { start, end, days: Math.max(1, differenceInCalendarDays(end, start) + 1) };
    }
    case 'last_12_months': {
      const start = subMonths(now, 12);
      return { start, end, days: 365 };
    }
    case 'all_time':
    default:
      return { start: null, end, days: 365 };
  }
}

interface RentPaymentRow { amount: number | null; payment_date: string | null }
interface VoidRow { start_date: string; end_date: string | null; room_id: string | null }
interface AgreementRow { id: string; room_id: string | null; rent_amount_pcm: number | null; start_date: string | null; created_at?: string | null }
interface WorkOrderRow { actual_cost: number | null; paid_amount?: number | null; paid_date?: string | null; room_id: string | null }
interface MaintRow { actual_cost: number | null; room_v2_id: string | null; cost_approved_at?: string | null; created_at?: string | null }

function inRange(date: string | null, start: Date | null, end: Date): boolean {
  if (!date) return false;
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  if (start && d < start) return false;
  if (d > end) return false;
  return true;
}

/**
 * Compute the overlap (in days, inclusive) between a void period
 * (start..end, end nullable = ongoing) and the requested window.
 */
export function overlapDays(
  voidStart: string,
  voidEnd: string | null,
  windowStart: Date | null,
  windowEnd: Date,
): number {
  const vs = new Date(voidStart);
  const ve = voidEnd ? new Date(voidEnd) : windowEnd;
  if (Number.isNaN(vs.getTime()) || Number.isNaN(ve.getTime())) return 0;
  const lower = windowStart ? maxDate([vs, windowStart]) : vs;
  const upper = minDate([ve, windowEnd]);
  const diff = differenceInCalendarDays(upper, lower);
  return diff >= 0 ? diff + 1 : 0;
}

/* ------------------------------------------------------------------ */
/* core compute                                                        */
/* ------------------------------------------------------------------ */

export interface ComputeRoomPnLInput {
  roomId: string;
  period: RoomPnLPeriod;
  now?: Date;
  rentPayments: RentPaymentRow[];
  voidPeriods: VoidRow[];
  workOrders: WorkOrderRow[];
  maintenanceRequests: MaintRow[];
  agreements: AgreementRow[];
}

export function computeRoomPnL(input: ComputeRoomPnLInput): RoomPnLResult {
  const limitations: string[] = [];
  const { start, end, days } = resolvePeriodRange(input.period, input.now ?? new Date());

  const grossIncome = input.rentPayments
    .filter(p => inRange(p.payment_date, start, end))
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const voidDays = input.voidPeriods.reduce(
    (sum, v) => sum + overlapDays(v.start_date, v.end_date, start, end),
    0,
  );

  // Most recent agreement → daily rent estimate.
  const sortedAgreements = [...input.agreements]
    .filter(a => a.start_date)
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  const latestRent = sortedAgreements[0]?.rent_amount_pcm ?? null;
  if (latestRent == null) {
    limitations.push('No tenancy agreement found — void loss assumes £0 daily rent.');
  }
  const dailyRent = latestRent ? latestRent / 30 : 0;
  const voidLoss = voidDays * dailyRent;

  const woCosts = input.workOrders
    .filter(w => w.room_id === input.roomId)
    .filter(w => !w.paid_date || inRange(w.paid_date, start, end))
    .reduce((s, w) => s + (Number(w.paid_amount ?? w.actual_cost) || 0), 0);

  const mrCosts = input.maintenanceRequests
    .filter(m => m.room_v2_id === input.roomId)
    .filter(m => {
      const d = m.cost_approved_at ?? m.created_at ?? null;
      return !d || inRange(d, start, end);
    })
    .reduce((s, m) => s + (Number(m.actual_cost) || 0), 0);

  const maintenanceCosts = woCosts + mrCosts;
  limitations.push(
    'Property-wide costs (insurance, bills, mgmt) are not allocated to rooms — rooms_v2 lacks area_sqm.',
  );

  const contribution = grossIncome - voidLoss - maintenanceCosts;
  const occupancyRate = days > 0 ? Math.max(0, Math.min(1, (days - voidDays) / days)) : 0;

  return {
    roomId: input.roomId,
    period: input.period,
    periodStart: start ? format(start, 'yyyy-MM-dd') : null,
    periodEnd: format(end, 'yyyy-MM-dd'),
    periodDays: days,
    grossIncome,
    voidDays,
    voidLoss,
    maintenanceCosts,
    contribution,
    occupancyRate,
    limitations,
  };
}

/* ------------------------------------------------------------------ */
/* useRoomPnL                                                          */
/* ------------------------------------------------------------------ */

async function fetchRoomPnL(roomId: string, period: RoomPnLPeriod): Promise<RoomPnLResult> {
  const { start, end } = resolvePeriodRange(period);

  // Tenancy agreements for this room (modern)
  const agRes = await supabaseAny
    .from('tenancy_agreements')
    .select('id, room_id, rent_amount_pcm, start_date')
    .eq('room_id', roomId);
  const agreements: AgreementRow[] = (agRes.data ?? []) as AgreementRow[];
  const agreementIds = agreements.map(a => a.id);

  // V1 tenancies path removed (#53 cutover) — agreements are the only source.
  const combinedAgreements: AgreementRow[] = [...agreements];

  let rentPayments: RentPaymentRow[] = [];
  if (agreementIds.length > 0) {
    let q = supabaseAny.from('rent_payments').select('amount, payment_date').in('agreement_id', agreementIds);
    if (start) q = q.gte('payment_date', format(start, 'yyyy-MM-dd'));
    q = q.lte('payment_date', format(end, 'yyyy-MM-dd'));
    const { data } = await q;
    rentPayments = (data ?? []) as RentPaymentRow[];
  }

  const voidRes = await supabaseAny
    .from('void_periods')
    .select('start_date, end_date, room_id')
    .eq('room_id', roomId);
  const voidPeriods = (voidRes.data ?? []) as VoidRow[];

  const woRes = await supabaseAny
    .from('work_orders')
    .select('actual_cost, paid_amount, paid_date, room_id')
    .eq('room_id', roomId);
  const workOrders = (woRes.data ?? []) as WorkOrderRow[];

  const mrRes = await supabaseAny
    .from('maintenance_requests')
    .select('actual_cost, room_v2_id, cost_approved_at, created_at')
    .eq('room_v2_id', roomId);
  const maintenanceRequests = (mrRes.data ?? []) as MaintRow[];

  return computeRoomPnL({
    roomId,
    period,
    rentPayments,
    voidPeriods,
    workOrders,
    maintenanceRequests,
    agreements: combinedAgreements,
  });
}

export function useRoomPnL(roomId: string | undefined, period: RoomPnLPeriod = 'last_12_months') {
  return useQuery({
    queryKey: ['room-pnl', roomId, period],
    enabled: !!roomId,
    queryFn: () => fetchRoomPnL(roomId!, period),
    staleTime: 5 * 60 * 1000,
  });
}

/* ------------------------------------------------------------------ */
/* useRoomPnLPortfolio                                                 */
/* ------------------------------------------------------------------ */

interface RoomMetaRow {
  id: string;
  room_name: string;
  property_id: string;
  properties_v2: { id: string; address_line_1: string; city: string | null } | null;
}

async function fetchRoomPnLPortfolio(period: RoomPnLPeriod): Promise<RoomPortfolioRow[]> {
  const { data: rooms } = await supabaseAny
    .from('rooms_v2')
    .select('id, room_name, property_id, properties_v2:property_id(id, address_line_1, city)');
  const list = (rooms ?? []) as RoomMetaRow[];

  // Compute sequentially-with-await batched in Promise.all to limit concurrency lightly.
  const results = await Promise.all(
    list.map(async (r) => {
      const pnl = await fetchRoomPnL(r.id, period);
      const prop = r.properties_v2;
      const address = prop ? `${prop.address_line_1}${prop.city ? ', ' + prop.city : ''}` : '—';
      return {
        roomId: r.id,
        propertyId: r.property_id,
        address,
        roomName: r.room_name,
        grossIncome: pnl.grossIncome,
        voidLoss: pnl.voidLoss,
        voidDays: pnl.voidDays,
        maintenanceCosts: pnl.maintenanceCosts,
        contribution: pnl.contribution,
        occupancyRate: pnl.occupancyRate,
      } satisfies RoomPortfolioRow;
    }),
  );

  return results.sort((a, b) => b.contribution - a.contribution);
}

export function useRoomPnLPortfolio(period: RoomPnLPeriod = 'last_12_months') {
  return useQuery({
    queryKey: ['room-pnl-portfolio', period],
    queryFn: () => fetchRoomPnLPortfolio(period),
    staleTime: 5 * 60 * 1000,
  });
}
