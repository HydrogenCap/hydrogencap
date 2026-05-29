import { useQuery } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import {
  RENT_SCHEDULE_SELECT,
  type RentScheduleWithDetails,
  type ArrearsAgingRow,
  type MonthSummaryData,
} from './types';
import { normalizeRentItem } from './internal';
import { useRentSchedule } from './useRentSchedule';

export function useRentSummary(month?: string) {
  const { data } = useRentSchedule({ month });
  const schedule = data?.items;

  if (!schedule) return null;

  const totalExpected = schedule.reduce((sum, item) => sum + item.rent_amount + item.additional_charges, 0);
  const totalReceived = schedule.reduce((sum, item) => sum + item.amount_paid, 0);
  const totalOutstanding = schedule.reduce((sum, item) => sum + item.amount_outstanding, 0);
  const collectionRate = totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0;

  return {
    totalExpected,
    totalReceived,
    totalOutstanding,
    collectionRate,
    paid: schedule.filter(s => s.status === 'paid').length,
    partial: schedule.filter(s => s.status === 'partial').length,
    overdue: schedule.filter(s => s.status === 'overdue').length,
    upcoming: schedule.filter(s => s.status === 'upcoming').length,
    due: schedule.filter(s => s.status === 'due').length,
    bad_debt: schedule.filter(s => s.status === 'bad_debt').length,
  };
}

// ─── Arrears Aging ───

export function useArrearsAging() {
  return useQuery({
    queryKey: ['rent_schedule', 'arrears_aging'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT)
        .in('status', ['overdue', 'partial', 'due'])
        .lte('due_date', new Date().toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const today = new Date();
      const items = data as RentScheduleWithDetails[];
      const propertyMap = new Map<string, ArrearsAgingRow>();

      for (const item of items) {
        const display = normalizeRentItem(item);
        const propId = display.propertyId;
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );
        const amount = item.amount_outstanding;

        let bucket: 'bucket_30' | 'bucket_60' | 'bucket_90' | 'bucket_more';
        if (daysOverdue <= 30) bucket = 'bucket_30';
        else if (daysOverdue <= 60) bucket = 'bucket_60';
        else if (daysOverdue <= 90) bucket = 'bucket_90';
        else bucket = 'bucket_more';

        if (!propertyMap.has(propId)) {
          propertyMap.set(propId, {
            property_id: propId,
            property_address: display.propertyAddress,
            property_postcode: display.propertyPostcode,
            bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_more: 0, total: 0,
            tenancies: [],
          });
        }

        const row = propertyMap.get(propId)!;
        row[bucket] += amount;
        row.total += amount;

        let tenancy = row.tenancies.find(t => t.tenancy_id === item.tenancy_id);
        if (!tenancy) {
          tenancy = {
            tenancy_id: item.tenancy_id,
            tenant_name: display.tenantName,
            room_name: display.roomName,
            bucket_30: 0, bucket_60: 0, bucket_90: 0, bucket_more: 0, total: 0,
            schedule_items: [],
          };
          row.tenancies.push(tenancy);
        }
        tenancy[bucket] += amount;
        tenancy.total += amount;
        tenancy.schedule_items.push(item);
      }

      return Array.from(propertyMap.values()).sort((a, b) => b.total - a.total);
    },
  });
}

// ─── Month Summary ───

export function useMonthSummary() {
  return useQuery({
    queryKey: ['rent_schedule', 'month_summary'],
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonthEnd = new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0);

      const [overdueRes, dueTodayRes, thisMonthRes, nextMonthRes] = await Promise.all([
        supabase.from('rent_schedule').select('amount_outstanding').in('status', ['overdue', 'partial']).lt('due_date', todayStr),
        supabase.from('rent_schedule').select('amount_outstanding').eq('due_date', todayStr).neq('status', 'paid'),
        supabase.from('rent_schedule').select('rent_amount, additional_charges, amount_paid').gte('due_date', thisMonthStart).lt('due_date', nextMonthStart),
        supabase.from('rent_schedule').select('rent_amount, additional_charges').gte('due_date', nextMonthStart).lte('due_date', nextMonthEnd.toISOString().split('T')[0]),
      ]);

      return {
        totalOverdue: overdueRes.data?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0,
        dueToday: dueTodayRes.data?.reduce((s, r) => s + (r.amount_outstanding || 0), 0) || 0,
        thisMonthExpected: thisMonthRes.data?.reduce((s, r) => s + r.rent_amount + r.additional_charges, 0) || 0,
        thisMonthCollected: thisMonthRes.data?.reduce((s, r) => s + (r.amount_paid || 0), 0) || 0,
        nextMonthExpected: nextMonthRes.data?.reduce((s, r) => s + r.rent_amount + r.additional_charges, 0) || 0,
      } as MonthSummaryData;
    },
  });
}
