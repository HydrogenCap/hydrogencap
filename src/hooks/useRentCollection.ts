 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { fetchUserOrgId as getUserOrgId } from './useUserOrg';
 import { useToast } from '@/hooks/use-toast';
 import { formatPropertyAddress } from '@/utils/formatAddress';
 
 export type RentStatus = 'upcoming' | 'due' | 'paid' | 'partial' | 'overdue' | 'bad_debt';
 
 export interface RentScheduleItem {
   id: string;
   org_id: string;
   tenancy_id: string;
   agreement_id: string | null;
   due_date: string;
   period_start: string;
   period_end: string;
   rent_amount: number;
   additional_charges: number;
   amount_paid: number;
   amount_outstanding: number;
   status: RentStatus;
   reminder_sent_at: string | null;
   warning_sent_at: string | null;
   notes: string | null;
   created_at: string;
   updated_at: string;
 }
 
 export interface RentScheduleWithDetails extends RentScheduleItem {
   // V2 agreement join (preferred when agreement_id is set)
   agreement: {
     id: string;
     rent_amount_pcm: number;
     status: string;
     start_date: string;
     tenant: {
       id: string;
       first_name: string;
       last_name: string;
       tenant_type: string;
       email: string | null;
       phone: string | null;
     };
     room: {
       id: string;
       room_name: string;
     };
     property: {
       id: string;
       address_line_1: string;
       city: string;
       postcode: string;
     };
   } | null;
   // V1 tenancy join (fallback when agreement_id is null)
   tenancy: {
     id: string;
     tenant: {
       id: string;
       first_name: string;
       last_name: string;
       tenant_type?: string;
       company_name?: string | null;
       email?: string | null;
       phone?: string | null;
     };
     room: {
       room_name: string;
     };
     property: {
       id: string;
       address_line: string;
       town_city: string | null;
       postcode: string | null;
     };
   } | null;
 }

/**
 * Normalize V1 tenancy join OR V2 agreement join into a common display shape.
 * All UI components use this — they never access .tenancy or .agreement directly.
 */
export interface RentItemDisplay {
  tenantName: string;
  tenantEmail: string | null;
  tenantPhone: string | null;
  tenantId: string;
  roomName: string;
  roomId: string | null;
  propertyId: string;
  propertyAddress: string;
  propertyPostcode: string | null;
  tenancyId: string;
  agreementId: string | null;
}

export function normalizeRentItem(item: RentScheduleWithDetails): RentItemDisplay {
  // Prefer V2 agreement data when available
  if (item.agreement) {
    const a = item.agreement;
    return {
      tenantName: `${a.tenant.first_name} ${a.tenant.last_name}`,
      tenantEmail: a.tenant.email,
      tenantPhone: a.tenant.phone,
      tenantId: a.tenant.id,
      roomName: a.room.room_name,
      roomId: a.room.id,
      propertyId: a.property.id,
      propertyAddress: `${a.property.address_line_1}, ${a.property.city}`,
      propertyPostcode: a.property.postcode,
      tenancyId: item.tenancy_id,
      agreementId: item.agreement_id,
    };
  }

  // Fallback to V1 tenancy data
  if (item.tenancy) {
    const t = item.tenancy;
    const tenantName = t.tenant.tenant_type === 'company'
      ? (t.tenant.company_name || `${t.tenant.first_name} ${t.tenant.last_name}`)
      : `${t.tenant.first_name} ${t.tenant.last_name}`;
    return {
      tenantName,
      tenantEmail: t.tenant.email || null,
      tenantPhone: t.tenant.phone || null,
      tenantId: t.tenant.id,
      roomName: t.room.room_name,
      roomId: null,
      propertyId: t.property.id,
      propertyAddress: t.property.address_line
        ? `${t.property.address_line}${t.property.town_city ? `, ${t.property.town_city}` : ''}`
        : 'Unknown',
      propertyPostcode: t.property.postcode,
      tenancyId: item.tenancy_id,
      agreementId: item.agreement_id,
    };
  }

  // Neither available (shouldn't happen)
  return {
    tenantName: 'Unknown',
    tenantEmail: null,
    tenantPhone: null,
    tenantId: '',
    roomName: 'Unknown',
    roomId: null,
    propertyId: '',
    propertyAddress: 'Unknown',
    propertyPostcode: null,
    tenancyId: item.tenancy_id,
    agreementId: item.agreement_id,
  };
}
 
export interface RentPayment {
   id: string;
   org_id: string;
   tenancy_id: string;
   agreement_id?: string | null;
   rent_schedule_id: string | null;
   amount: number;
   payment_date: string;
   payment_method: string | null;
   reference: string | null;
   is_reconciled: boolean;
   notes: string | null;
   recorded_by: string | null;
   created_at: string;
 }

interface RentScheduleNotesUpdate {
  notes?: string;
  tags?: string[];
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';
 
// Shared select fragment for dual V1/V2 joins
const RENT_SCHEDULE_SELECT = `
  id, org_id, tenancy_id, agreement_id, due_date, period_start, period_end,
  rent_amount, additional_charges, amount_paid, amount_outstanding, status,
  reminder_sent_at, warning_sent_at, notes, created_at, updated_at, payment_reference, tags,
  agreement:tenancy_agreements(
    id,
    rent_amount_pcm,
    status,
    start_date,
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
`;

export function useRentSchedule(filters?: { 
  month?: string;
  status?: RentStatus;
  tenancyId?: string;
  agreementId?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = filters?.page;
  const pageSize = filters?.pageSize ?? 50;

  return useQuery({
    queryKey: ['rent_schedule', filters],
    queryFn: async () => {
      let query = supabase
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT, { count: 'exact' })
        .order('due_date', { ascending: true });

      if (filters?.month) {
        const startDate = `${filters.month}-01`;
        const endDate = new Date(parseInt(filters.month.split('-')[0]), parseInt(filters.month.split('-')[1]), 0);
        query = query
          .gte('due_date', startDate)
          .lte('due_date', endDate.toISOString().split('T')[0]);
      }
      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.tenancyId) query = query.eq('tenancy_id', filters.tenancyId);
      if (filters?.agreementId) query = query.eq('agreement_id', filters.agreementId);

      if (page) {
        const from = (page - 1) * pageSize;
        query = query.range(from, from + pageSize - 1);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      const items = (data ?? []) as RentScheduleWithDetails[];
      const total = count ?? items.length;
      return {
        items,
        total,
        page: page ?? 1,
        pageSize: page ? pageSize : total || 1,
        totalPages: page ? Math.ceil(total / pageSize) : 1,
      };
    },
  });
}
 
 export function useArrears() {
   return useQuery({
     queryKey: ['rent_schedule', 'arrears'],
     queryFn: async () => {
       const { data, error } = await supabase
         .from('rent_schedule')
         .select(RENT_SCHEDULE_SELECT)
         .in('status', ['overdue', 'partial'])
         .order('due_date', { ascending: true });
 
       if (error) throw error;
       
       const today = new Date();
       return (data as RentScheduleWithDetails[]).map(item => ({
         ...item,
         days_overdue: Math.floor((today.getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)),
       }));
     },
   });
 }
 
 export function useRentPayments(tenancyId?: string) {
   return useQuery({
     queryKey: ['rent_payments', tenancyId],
     queryFn: async () => {
        let query = supabase
          .from('rent_payments')
          .select('id, org_id, tenancy_id, agreement_id, rent_schedule_id, amount, payment_date, payment_method, reference, is_reconciled, notes, recorded_by, created_at')
         .order('payment_date', { ascending: false });
 
       if (tenancyId) {
         query = query.eq('tenancy_id', tenancyId);
       }
 
       const { data, error } = await query;
       if (error) throw error;
       return data as RentPayment[];
     },
   });
 }
 
 export function useRecordPayment() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (payment: Omit<RentPayment, 'id' | 'org_id' | 'created_at' | 'is_reconciled' | 'recorded_by'>) => {
       const orgId = await getUserOrgId();
       if (!orgId) throw new Error('No organization found');
 
       const { data: { user } } = await supabase.auth.getUser();
 
       const { data, error } = await supabase
         .from('rent_payments')
         .insert({ 
           ...payment, 
           org_id: orgId,
           recorded_by: user?.id || null,
           agreement_id: payment.agreement_id || null,
         })
         .select()
         .single();
 
       if (error) throw error;
       return data;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['rent_payments'] });
       queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
       toast({ title: 'Payment recorded' });
     },
     onError: (error) => {
       toast({ title: 'Failed to record payment', description: error.message, variant: 'destructive' });
     },
   });
 }
 
export function useRentScheduleItem(id: string) {
  return useQuery({
    queryKey: ['rent_schedule', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rent_schedule')
        .select(RENT_SCHEDULE_SELECT)
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as RentScheduleWithDetails;
    },
    enabled: !!id,
  });
}

export function useUpdateRentScheduleStatus() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RentStatus }) => {
      const { error } = await supabase.rpc('update_rent_schedule_item_status', {
        p_id: id,
        p_status: status,
      });
      if (error) throw error;
      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Status updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update status', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePaymentReminders(rentScheduleId: string) {
  return useQuery({
    queryKey: ['payment_reminders', rentScheduleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payment_reminders')
        .select('id, rent_schedule_id, reminder_type, sent_at, sent_via, status, recipient_email, recipient_name, error_message, resend_id, tenancy_id, org_id, created_at')
        .eq('rent_schedule_id', rentScheduleId)
        .order('sent_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!rentScheduleId,
  });
}

export function useSendReminder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (params: {
      rentScheduleId: string;
      tenancyId: string;
      reminderType: string;
      customMessage?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('send-rent-reminder', {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment_reminders'] });
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Reminder sent', description: `Sent to ${data.sentTo}` });
    },
    onError: (error) => {
      toast({ title: 'Failed to send reminder', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteRentSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('rent_schedule').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Payment deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDuplicateRentSchedule() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (item: RentScheduleWithDetails) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');

      const prefix = 'HYD';
      const letters = Array.from({ length: 3 }, () =>
        String.fromCharCode(65 + Math.floor(Math.random() * 26))
      ).join('');
      const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');

      const { data: newId, error } = await supabase.rpc('insert_rent_schedule_item', {
        p_org_id: orgId,
        p_tenancy_id: item.tenancy_id,
        p_due_date: item.due_date,
        p_period_start: item.period_start,
        p_period_end: item.period_end,
        p_rent_amount: item.rent_amount,
        p_additional_charges: item.additional_charges,
        p_amount_paid: 0,
        p_amount_outstanding: item.rent_amount + item.additional_charges,
        p_status: 'upcoming',
        p_payment_reference: `${prefix}-${letters}${numbers}`,
        p_notes: item.notes ? `Copy of: ${item.notes}` : null,
        p_agreement_id: item.agreement_id || undefined,
      });

      if (error) throw error;
      return { id: newId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Payment duplicated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to duplicate', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateRentScheduleNotes() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, notes, tags }: { id: string; notes?: string; tags?: string[] }) => {
      const updates: RentScheduleNotesUpdate = {};
      if (notes !== undefined) updates.notes = notes;
      if (tags !== undefined) updates.tags = tags;

      const { data, error } = await supabase
        .from('rent_schedule')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: 'Updated' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
}

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

export interface ArrearsAgingRow {
  property_id: string;
  property_address: string;
  property_postcode: string | null;
  bucket_30: number;
  bucket_60: number;
  bucket_90: number;
  bucket_more: number;
  total: number;
  tenancies: {
    tenancy_id: string;
    tenant_name: string;
    room_name: string;
    bucket_30: number;
    bucket_60: number;
    bucket_90: number;
    bucket_more: number;
    total: number;
    schedule_items: RentScheduleWithDetails[];
  }[];
}

export function useArrearsAging() {
  return useQuery({
    queryKey: ['rent_schedule', 'arrears_aging'],
    queryFn: async () => {
      const { data, error } = await supabase
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

export interface MonthSummaryData {
  totalOverdue: number;
  dueToday: number;
  thisMonthExpected: number;
  thisMonthCollected: number;
  nextMonthExpected: number;
}

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

// ─── Tenancy Ledger ───

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'rent' | 'payment';
  description: string;
  status: RentStatus | 'payment' | null;
  amount: number;
  running_balance: number;
  rent_schedule_id: string | null;
  payment_id: string | null;
  is_future: boolean;
}

export function useTenancyLedger(params: string | { tenancyId?: string; agreementId?: string } | undefined) {
  // Support both old string signature and new object signature
  const tenancyId = typeof params === 'string' ? params : params?.tenancyId;
  const agreementId = typeof params === 'string' ? undefined : params?.agreementId;
  const enabled = !!(tenancyId || agreementId);

  return useQuery({
    queryKey: ['tenancy_ledger', tenancyId, agreementId],
    queryFn: async () => {
      // Build schedule query
      let schedQuery = supabase
        .from('rent_schedule')
        .select('*')
        .order('due_date', { ascending: true });

      if (agreementId) {
        schedQuery = schedQuery.eq('agreement_id', agreementId);
      } else if (tenancyId) {
        schedQuery = schedQuery.eq('tenancy_id', tenancyId);
      }

      // Build payments query
      let payQuery = supabase
        .from('rent_payments')
        .select('*')
        .order('payment_date', { ascending: true });

      if (agreementId) {
        payQuery = payQuery.eq('agreement_id', agreementId);
      } else if (tenancyId) {
        payQuery = payQuery.eq('tenancy_id', tenancyId);
      }

      const [schedRes, payRes] = await Promise.all([schedQuery, payQuery]);

      if (schedRes.error) throw schedRes.error;
      if (payRes.error) throw payRes.error;

      const today = new Date().toISOString().split('T')[0];
      const entries: LedgerEntry[] = [];
      
      for (const item of schedRes.data || []) {
        const periodStart = new Date(item.period_start);
        const periodEnd = new Date(item.period_end);
        entries.push({
          id: item.id,
          date: item.due_date,
          type: 'rent',
          description: `Rent (${periodStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} – ${periodEnd.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`,
          status: item.status as RentStatus,
          amount: item.rent_amount + (item.additional_charges || 0),
          running_balance: 0,
          rent_schedule_id: item.id,
          payment_id: null,
          is_future: item.due_date > today,
        });
      }
      
      for (const payment of payRes.data || []) {
        entries.push({
          id: payment.id,
          date: payment.payment_date,
          type: 'payment',
          description: payment.reference ? `Payment (${payment.reference})` : 'Payment',
          status: 'payment',
          amount: -payment.amount,
          running_balance: 0,
          rent_schedule_id: payment.rent_schedule_id,
          payment_id: payment.id,
          is_future: false,
        });
      }
      
      entries.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        if (a.type === 'rent' && b.type === 'payment') return -1;
        if (a.type === 'payment' && b.type === 'rent') return 1;
        return 0;
      });
      
      let balance = 0;
      for (const entry of entries) {
        if (!entry.is_future) {
          balance += entry.amount;
          entry.running_balance = balance;
        }
      }
      
      return entries.reverse();
    },
    enabled,
  });
}

// ─── Paid On Time Stats ───

// ─── Bulk Actions ───

export function useBulkMarkPaid() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      paymentMethod,
      paymentDate,
      notes,
      onProgress,
    }: {
      items: RentScheduleWithDetails[];
      paymentMethod: string;
      paymentDate: 'due_date' | string;
      notes: string;
      onProgress?: (count: number) => void;
    }) => {
      const orgId = await getUserOrgId();
      if (!orgId) throw new Error('No organization found');
      const { data: { user } } = await supabase.auth.getUser();

      const results = { success: 0, failed: 0, errors: [] as string[] };

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const display = normalizeRentItem(item);
        try {
          const actualPaymentDate = paymentDate === 'due_date'
            ? item.due_date
            : paymentDate;

          const { error: payError } = await supabase
            .from('rent_payments')
            .insert({
              org_id: orgId,
              tenancy_id: item.tenancy_id,
              rent_schedule_id: item.id,
              amount: item.amount_outstanding,
              payment_date: actualPaymentDate,
              payment_method: paymentMethod,
              reference: null,
              notes,
              recorded_by: user?.id || null,
              agreement_id: item.agreement_id || null,
            });

          if (payError) throw payError;

          const { error: schedError } = await supabase.rpc('update_rent_schedule_item_status', {
            p_id: item.id,
            p_status: 'paid',
            p_amount_paid: item.rent_amount + (item.additional_charges || 0),
          });

          if (schedError) throw schedError;

          results.success++;
        } catch (error) {
          results.failed++;
          results.errors.push(`${display.propertyAddress}: ${getErrorMessage(error)}`);
        }
        onProgress?.(i + 1);
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['rent_payments'] });

      if (results.failed === 0) {
        toast({ title: `${results.success} payments recorded` });
      } else {
        toast({
          title: `${results.success} succeeded, ${results.failed} failed`,
          description: results.errors.slice(0, 3).join('\n'),
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({ title: 'Bulk payment failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkWriteOff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      reason,
    }: {
      items: RentScheduleWithDetails[];
      reason?: string;
    }) => {
      const ids = items.map(item => item.id);
      const { error } = await supabase.rpc('bulk_update_rent_schedule_status', {
        p_ids: ids,
        p_status: 'bad_debt',
        p_notes: reason ? `Bad debt write-off: ${reason}` : 'Bulk write-off as bad debt',
      });

      if (error) throw error;
      return { count: ids.length };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: `${result.count} items written off` });
    },
    onError: (error) => {
      toast({ title: 'Write-off failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkAddNote() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      note,
      mode,
    }: {
      items: RentScheduleWithDetails[];
      note: string;
      mode: 'append' | 'replace';
    }) => {
      const today = new Date().toLocaleDateString('en-GB');
      let count = 0;

      for (const item of items) {
        let newNotes: string;
        if (mode === 'replace') {
          newNotes = note;
        } else {
          const separator = `\n--- ${today} ---\n`;
          newNotes = item.notes
            ? `${item.notes}${separator}${note}`
            : note;
        }

        const { error } = await supabase
          .from('rent_schedule')
          .update({ notes: newNotes })
          .eq('id', item.id);

        if (!error) count++;
      }

      return { count };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: `Note added to ${result.count} items` });
    },
    onError: (error) => {
      toast({ title: 'Failed to add notes', description: error.message, variant: 'destructive' });
    },
  });
}

export function useBulkSendReminder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      items,
      reminderType,
      customMessage,
    }: {
      items: RentScheduleWithDetails[];
      reminderType: string;
      customMessage?: string;
    }) => {
      const results = { sent: 0, skipped: 0, failed: 0 };

      for (const item of items) {
        const display = normalizeRentItem(item);
        const email = display.tenantEmail;
        if (!email) {
          results.skipped++;
          continue;
        }

        try {
          const { error } = await supabase.functions.invoke('send-rent-reminder', {
            body: {
              rentScheduleId: item.id,
              tenancyId: item.tenancy_id,
              reminderType,
              customMessage,
            },
          });
          if (error) throw error;
          results.sent++;
        } catch (err) {
          console.error('Failed to send reminder:', err);
          results.failed++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      queryClient.invalidateQueries({ queryKey: ['payment_reminders'] });

      const parts = [];
      if (results.sent > 0) parts.push(`${results.sent} sent`);
      if (results.skipped > 0) parts.push(`${results.skipped} skipped (no email)`);
      if (results.failed > 0) parts.push(`${results.failed} failed`);

      toast({
        title: 'Reminders processed',
        description: parts.join(', '),
        variant: results.failed > 0 ? 'destructive' : 'default',
      });
    },
    onError: (error) => {
      toast({ title: 'Failed to send reminders', description: error.message, variant: 'destructive' });
    },
  });
}

export function usePaidOnTimeStats(params: string | { tenancyId?: string; agreementId?: string } | undefined) {
  // Support both old string signature and new object signature
  const tenancyId = typeof params === 'string' ? params : params?.tenancyId;
  const agreementId = typeof params === 'string' ? undefined : params?.agreementId;
  const enabled = !!(tenancyId || agreementId);

  return useQuery({
    queryKey: ['paid_on_time', tenancyId, agreementId],
    queryFn: async () => {
      const todayStr = new Date().toISOString().split('T')[0];
      
      const filterCol = agreementId ? 'agreement_id' : 'tenancy_id';
      const filterVal = agreementId || tenancyId!;

      const [paidRes, allPastRes, paymentsRes] = await Promise.all([
        supabase.from('rent_schedule').select('id, due_date')
          .eq(filterCol, filterVal).lte('due_date', todayStr).eq('status', 'paid'),
        supabase.from('rent_schedule').select('id')
          .eq(filterCol, filterVal).lte('due_date', todayStr).neq('status', 'upcoming'),
        supabase.from('rent_payments').select('rent_schedule_id, payment_date')
          .eq(filterCol, filterVal),
      ]);

      const paidItems = paidRes.data || [];
      const totalPast = allPastRes.data?.length || 0;
      
      const paymentMap = new Map<string, string>();
      for (const p of paymentsRes.data || []) {
        if (p.rent_schedule_id && !paymentMap.has(p.rent_schedule_id)) {
          paymentMap.set(p.rent_schedule_id, p.payment_date);
        }
      }

      let totalDaysLate = 0;
      let lateCount = 0;
      for (const item of paidItems) {
        const paymentDate = paymentMap.get(item.id);
        if (paymentDate && paymentDate > item.due_date) {
          const daysLate = Math.floor(
            (new Date(paymentDate).getTime() - new Date(item.due_date).getTime()) / (1000 * 60 * 60 * 24)
          );
          totalDaysLate += daysLate;
          lateCount++;
        }
      }
      
      return {
        percentOnTime: totalPast > 0 ? Math.round((paidItems.length / totalPast) * 100) : 0,
        avgDaysLate: lateCount > 0 ? Math.round(totalDaysLate / lateCount * 10) / 10 : 0,
        totalPast,
      };
    },
    enabled,
  });
}

// ─── Generate Schedule from V2 Agreement ───

export function useGenerateScheduleFromAgreement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      agreementId,
      months = 12,
    }: {
      agreementId: string;
      months?: number;
    }) => {
      const { data: agreement, error: agError } = await supabase
        .from('tenancy_agreements')
        .select('id, org_id, rent_amount_pcm, start_date, initial_end_date, rent_frequency, status')
        .eq('id', agreementId)
        .single();

      if (agError || !agreement) throw agError || new Error('Agreement not found');

      // Look up V1 tenancy_id for backward compat
      const { data: existingSchedule } = await supabase
        .from('rent_schedule')
        .select('tenancy_id')
        .eq('agreement_id', agreementId)
        .limit(1);

      const tenancyId = existingSchedule?.[0]?.tenancy_id;

      if (tenancyId) {
        const { data: count, error } = await supabase.rpc('generate_rent_schedule', {
          p_tenancy_id: tenancyId,
          p_months: months,
          p_agreement_id: agreementId,
        });
        if (error) throw error;
        return { count: count || 0 };
      }

      // No V1 tenancy — generate manually
      const orgId = agreement.org_id;
      const startDate = new Date(agreement.start_date);
      const rentPCM = agreement.rent_amount_pcm;
      let count = 0;

      const { data: lastEntry } = await supabase
        .from('rent_schedule')
        .select('period_end')
        .eq('agreement_id', agreementId)
        .order('period_end', { ascending: false })
        .limit(1);

      let nextStart = lastEntry?.[0]
        ? new Date(new Date(lastEntry[0].period_end).getTime() + 86400000)
        : startDate;

      for (let i = 0; i < months; i++) {
        const periodStart = new Date(nextStart);
        const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
        const dueDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);

        if (agreement.initial_end_date && dueDate > new Date(agreement.initial_end_date)) break;

        const prefix = 'HYD';
        const letters = Array.from({ length: 3 }, () =>
          String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ).join('');
        const numbers = Math.floor(Math.random() * 100).toString().padStart(2, '0');

        if (!tenancyId) throw new Error('Cannot generate rent schedule: tenancy ID is required');

        const { error } = await supabase.from('rent_schedule').insert({
          org_id: orgId,
          tenancy_id: tenancyId,
          agreement_id: agreementId,
          due_date: dueDate.toISOString().split('T')[0],
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          rent_amount: rentPCM,
          additional_charges: 0,
          amount_paid: 0,
          amount_outstanding: rentPCM,
          status: 'upcoming' as RentStatus,
          payment_reference: `${prefix}-${letters}${numbers}`,
        });

        if (!error) count++;
        nextStart = new Date(periodEnd.getTime() + 86400000);
      }

      return { count };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['rent_schedule'] });
      toast({ title: `${result.count} schedule entries generated` });
    },
    onError: (error) => {
      toast({ title: 'Failed to generate schedule', description: error.message, variant: 'destructive' });
    },
  });
}
