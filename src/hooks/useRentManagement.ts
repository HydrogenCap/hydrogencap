import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchUserOrgId as getUserOrgId, useUserOrg } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';
import {
  type RentScheduleWithDetails,
  type RentPayment,
  type RentStatus,
  normalizeRentItem,
} from './useRentCollection';

// ─── KPI Metrics ───

export interface RentKPIs {
  totalMonthlyDue: number;
  collectedThisMonth: number;
  collectedPercent: number;
  outstandingThisMonth: number;
  avgDaysToPayment: number;
  avgDaysToPaymentTrend: 'up' | 'down' | 'flat';
  arrearsBalance: number;
}

export function useRentKPIs() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['rent_kpis', orgId],
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const thisMonthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
      const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
      const nextMonthStart = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;

      // Last month for trend comparison
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthStartStr = `${lastMonthStart.getFullYear()}-${String(lastMonthStart.getMonth() + 1).padStart(2, '0')}-01`;

      const [thisMonthRes, arrearsRes, paymentsThisMonth, paymentsLastMonth] = await Promise.all([
        (supabase as any)
          .from('rent_schedule')
          .select('rent_amount, additional_charges, amount_paid, amount_outstanding, status, due_date')
          .gte('due_date', thisMonthStart)
          .lt('due_date', nextMonthStart),
        (supabase as any)
          .from('rent_schedule')
          .select('amount_outstanding')
          .in('status', ['overdue', 'partial']),
        (supabase as any)
          .from('rent_payments')
          .select('amount, payment_date, rent_schedule_id')
          .gte('payment_date', thisMonthStart)
          .lt('payment_date', nextMonthStart),
        (supabase as any)
          .from('rent_payments')
          .select('amount, payment_date, rent_schedule_id')
          .gte('payment_date', lastMonthStartStr)
          .lt('payment_date', thisMonthStart),
      ]);

      const thisMonthItems = thisMonthRes.data || [];
      const totalMonthlyDue = thisMonthItems.reduce(
        (s, r) => s + (r.rent_amount || 0) + (r.additional_charges || 0),
        0
      );
      const collectedThisMonth = thisMonthItems.reduce((s, r) => s + (r.amount_paid || 0), 0);
      const outstandingThisMonth = thisMonthItems.reduce((s, r) => s + (r.amount_outstanding || 0), 0);
      const collectedPercent = totalMonthlyDue > 0 ? Math.round((collectedThisMonth / totalMonthlyDue) * 100) : 0;

      const arrearsBalance = (arrearsRes.data || []).reduce((s, r) => s + (r.amount_outstanding || 0), 0);

      // Calculate average days to payment from this month's payments
      const calcAvgDays = (payments: typeof paymentsThisMonth.data) => {
        if (!payments || payments.length === 0) return 0;
        // Rough estimate: days between 1st of month and payment date
        const totalDays = payments.reduce((sum, p) => {
          const payDate = new Date(p.payment_date);
          return sum + payDate.getDate();
        }, 0);
        return Math.round(totalDays / payments.length);
      };

      const avgDaysThisMonth = calcAvgDays(paymentsThisMonth.data);
      const avgDaysLastMonth = calcAvgDays(paymentsLastMonth.data);

      let avgDaysToPaymentTrend: 'up' | 'down' | 'flat' = 'flat';
      if (avgDaysThisMonth > avgDaysLastMonth + 1) avgDaysToPaymentTrend = 'up';
      else if (avgDaysThisMonth < avgDaysLastMonth - 1) avgDaysToPaymentTrend = 'down';

      return {
        totalMonthlyDue,
        collectedThisMonth,
        collectedPercent,
        outstandingThisMonth,
        avgDaysToPayment: avgDaysThisMonth,
        avgDaysToPaymentTrend,
        arrearsBalance,
      } as RentKPIs;
    },
    enabled: !!orgId,
  });
}

// ─── Record Payment Mutation (enhanced) ───

export interface RecordPaymentInput {
  tenancy_id: string;
  rent_schedule_id: string | null;
  amount: number;
  payment_date: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  agreement_id: string | null;
}

export function useRecordPaymentMutation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payment: RecordPaymentInput) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const { data: { user } } = await supabase.auth.getUser();

      const { data, error } = await (supabase as any)
        .from('rent_payments')
        .insert({
          ...payment,
          org_id: orgId,
          recorded_by: user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as RentPayment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_kpis'] });
      queryClient.invalidateQueries({ queryKey: ['rent_arrears'] });
      toast({ title: 'Payment recorded successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
    },
  });
}

// ─── Rent Arrears (grouped by severity) ───

export interface ArrearsEntry {
  scheduleItem: RentScheduleWithDetails;
  tenantName: string;
  tenantEmail: string | null;
  propertyAddress: string;
  roomName: string;
  amountOwed: number;
  daysOverdue: number;
  tenancyId: string;
  agreementId: string | null;
  lastPaymentDate: string | null;
}

export interface ArrearsGrouped {
  '7+': ArrearsEntry[];
  '30+': ArrearsEntry[];
  '60+': ArrearsEntry[];
  '90+': ArrearsEntry[];
}

export function useRentArrears() {
  return useQuery({
    queryKey: ['rent_arrears'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('rent_schedule')
        .select(`
          id, org_id, tenancy_id, agreement_id, due_date, period_start, period_end,
          rent_amount, additional_charges, amount_paid, amount_outstanding, status,
          reminder_sent_at, warning_sent_at, notes, created_at, updated_at,
          agreement:tenancy_agreements(
            id, rent_amount_pcm, status, start_date,
            tenant:tenants_v2(id, first_name, last_name, tenant_type, email, phone),
            room:rooms_v2(id, room_name),
            property:properties_v2(id, address_line_1, city, postcode)
          ),
          tenancy:tenancies(
            id,
            tenant:tenants(id, first_name, last_name, tenant_type, company_name, email, phone),
            room:rooms(room_name),
            property:properties(id, address_line, town_city, postcode)
          )
        `)
        .in('status', ['overdue', 'partial'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const today = new Date();
      const items = (data || []) as RentScheduleWithDetails[];

      const grouped: ArrearsGrouped = { '7+': [], '30+': [], '60+': [], '90+': [] };

      for (const item of items) {
        const display = normalizeRentItem(item);
        const daysOverdue = Math.floor(
          (today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysOverdue < 7) continue;

        const entry: ArrearsEntry = {
          scheduleItem: item,
          tenantName: display.tenantName,
          tenantEmail: display.tenantEmail,
          propertyAddress: display.propertyAddress,
          roomName: display.roomName,
          amountOwed: item.amount_outstanding,
          daysOverdue,
          tenancyId: item.tenancy_id,
          agreementId: item.agreement_id,
          lastPaymentDate: null,
        };

        if (daysOverdue >= 90) grouped['90+'].push(entry);
        else if (daysOverdue >= 60) grouped['60+'].push(entry);
        else if (daysOverdue >= 30) grouped['30+'].push(entry);
        else grouped['7+'].push(entry);
      }

      return grouped;
    },
  });
}

// ─── Rent History ───

export function useRentHistory(filters?: { propertyId?: string; tenantId?: string }) {
  return useQuery({
    queryKey: ['rent_history', filters],
    queryFn: async () => {
      const query = (supabase as any)
        .from('rent_payments')
        .select(`
          id, org_id, tenancy_id, agreement_id, rent_schedule_id,
          amount, payment_date, payment_method, reference, is_reconciled,
          notes, recorded_by, created_at
        `)
        .order('payment_date', { ascending: false })
        .limit(200);

      // Note: filtering by propertyId requires a join which isn't directly available on rent_payments.
      // We filter client-side if needed.
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as RentPayment[];
    },
  });
}

// ─── Rent Calendar Data ───

export interface RentCalendarEntry {
  id: string;
  dueDate: string;
  tenantName: string;
  propertyAddress: string;
  roomName: string;
  amount: number;
  amountPaid: number;
  status: RentStatus;
  paidOnTime: boolean;
}

export function useRentCalendar(month: string) {
  return useQuery({
    queryKey: ['rent_calendar', month],
    queryFn: async () => {
      const startDate = `${month}-01`;
      const [year, m] = month.split('-').map(Number);
      const endDate = new Date(year, m, 0);

      const { data, error } = await (supabase as any)
        .from('rent_schedule')
        .select(`
          id, org_id, tenancy_id, agreement_id, due_date, period_start, period_end,
          rent_amount, additional_charges, amount_paid, amount_outstanding, status,
          reminder_sent_at, warning_sent_at, notes, created_at, updated_at,
          agreement:tenancy_agreements(
            id, rent_amount_pcm, status, start_date,
            tenant:tenants_v2(id, first_name, last_name, tenant_type, email, phone),
            room:rooms_v2(id, room_name),
            property:properties_v2(id, address_line_1, city, postcode)
          ),
          tenancy:tenancies(
            id,
            tenant:tenants(id, first_name, last_name, tenant_type, company_name, email, phone),
            room:rooms(room_name),
            property:properties(id, address_line, town_city, postcode)
          )
        `)
        .gte('due_date', startDate)
        .lte('due_date', endDate.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (error) throw error;

      return ((data || []) as RentScheduleWithDetails[]).map((item) => {
        const display = normalizeRentItem(item);
        const dueDate = new Date(item.due_date);
        const today = new Date();
        const isPastDue = dueDate < today;

        return {
          id: item.id,
          dueDate: item.due_date,
          tenantName: display.tenantName,
          propertyAddress: display.propertyAddress,
          roomName: display.roomName,
          amount: item.rent_amount + item.additional_charges,
          amountPaid: item.amount_paid,
          status: item.status,
          paidOnTime: item.status === 'paid' && isPastDue,
        } as RentCalendarEntry;
      });
    },
  });
}
