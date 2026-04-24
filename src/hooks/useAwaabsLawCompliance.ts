/**
 * Awaab's Law Compliance Engine — Hooks
 *
 * Provides all tracking, deadline calculation, and escalation logic
 * for UK private rented sector hazard compliance (effective 1 May 2026).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { useToast } from '@/hooks/use-toast';
import { createNotification } from '@/lib/createNotification';
import {
  addWorkingDays,
  addHours,
  workingDaysRemaining,
  hoursRemaining,
  getDeadlineSeverity,
  type DeadlineSeverity,
} from '@/lib/working-days';
import type { MaintenanceCategory } from '@/lib/maintenanceTypes';

// ── Types ───────────────────────────────────────────────────────────────

export type HazardCategory = 'emergency' | 'significant' | 'standard' | 'not_hazard';
export type EscalationLevel = 'normal' | 'warning' | 'critical' | 'overdue' | 'breach';

export type AwaabsEventType =
  | 'hazard_reported' | 'investigation_started' | 'written_summary_sent'
  | 'repair_started' | 'repair_completed' | 'deadline_warning' | 'deadline_breach'
  | 'escalation_raised' | 'classification_changed' | 'note_added';

export interface AwaabsLawEvent {
  id: string;
  maintenance_request_id: string;
  org_id: string;
  event_type: AwaabsEventType;
  event_data: Record<string, unknown>;
  performed_by: string | null;
  created_at: string;
}

export interface AwaabsLawFields {
  hazard_category: HazardCategory | null;
  awaabs_law_applies: boolean;
  reported_at: string | null;
  investigation_started_at: string | null;
  investigation_due_by: string | null;
  written_summary_sent_at: string | null;
  written_summary_due_by: string | null;
  repair_started_at: string | null;
  repair_due_by: string | null;
  repair_completed_at: string | null;
  written_summary_text: string | null;
  escalation_level: EscalationLevel;
  breach_notified: boolean;
}

export interface HazardDeadlines {
  investigationDue: Date | null;
  writtenSummaryDue: Date | null;
  repairDue: Date | null;
  investigationSeverity: DeadlineSeverity | null;
  writtenSummarySeverity: DeadlineSeverity | null;
  repairSeverity: DeadlineSeverity | null;
  overallStatus: AwaabsTrackingStatus;
}

export type AwaabsTrackingStatus =
  | 'awaiting_investigation'
  | 'investigating'
  | 'summary_due'
  | 'awaiting_repair'
  | 'repair_in_progress'
  | 'completed'
  | 'not_applicable';

export const AWAABS_STATUS_CONFIG: Record<AwaabsTrackingStatus, { label: string; color: string }> = {
  awaiting_investigation: { label: 'Awaiting Investigation', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  investigating: { label: 'Investigating', color: 'bg-sky-100 text-sky-800 border-sky-200' },
  summary_due: { label: 'Summary Due', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  awaiting_repair: { label: 'Awaiting Repair', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  repair_in_progress: { label: 'Repair In Progress', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800 border-green-200' },
  not_applicable: { label: 'N/A', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

// ── Hazard auto-classification rules ────────────────────────────────────

const EMERGENCY_CATEGORIES: MaintenanceCategory[] = ['heating', 'fire_safety', 'structural'];
const EMERGENCY_KEYWORDS = [
  'no heating', 'no hot water', 'gas leak', 'flooding', 'flood',
  'structural collapse', 'fire safety', 'sewage', 'no electricity',
  'carbon monoxide', 'no power', 'boiler broken', 'boiler not working',
];

const SIGNIFICANT_CATEGORIES: MaintenanceCategory[] = ['damp_mould', 'pest_control', 'electrical', 'locks_security'];
const SIGNIFICANT_KEYWORDS = [
  'damp', 'mould', 'mold', 'pest', 'infestation', 'faulty electrics',
  'broken window', 'broken door', 'no working toilet', 'toilet broken',
  'rats', 'mice', 'cockroach', 'external door',
];

export function autoClassifyHazard(
  category: MaintenanceCategory,
  description: string,
  urgency?: string
): HazardCategory {
  const desc = (description || '').toLowerCase();

  // Emergency classification
  if (urgency === 'emergency') return 'emergency';
  if (EMERGENCY_CATEGORIES.includes(category) && urgency === 'high') return 'emergency';
  if (EMERGENCY_KEYWORDS.some(kw => desc.includes(kw))) return 'emergency';

  // Significant classification
  if (SIGNIFICANT_CATEGORIES.includes(category)) return 'significant';
  if (SIGNIFICANT_KEYWORDS.some(kw => desc.includes(kw))) return 'significant';

  return 'standard';
}

// ── Deadline calculations ───────────────────────────────────────────────

export function calculateDeadlines(
  reportedAt: Date,
  hazardCategory: HazardCategory,
  investigationStartedAt?: Date | null
): { investigationDue: Date; writtenSummaryDue: Date | null; repairDue: Date } {
  const investigationDue = addWorkingDays(reportedAt, 10);

  const writtenSummaryDue = investigationStartedAt
    ? addWorkingDays(investigationStartedAt, 3)
    : null;

  let repairDue: Date;
  if (hazardCategory === 'emergency') {
    repairDue = addHours(reportedAt, 24);
  } else if (hazardCategory === 'significant') {
    repairDue = addWorkingDays(reportedAt, 5);
  } else {
    // Standard: 28 working days (reasonable timescale)
    repairDue = addWorkingDays(reportedAt, 28);
  }

  return { investigationDue, writtenSummaryDue, repairDue };
}

export function getTrackingStatus(fields: AwaabsLawFields): AwaabsTrackingStatus {
  if (!fields.awaabs_law_applies || fields.hazard_category === 'not_hazard') return 'not_applicable';
  if (fields.repair_completed_at) return 'completed';
  if (fields.repair_started_at) return 'repair_in_progress';
  if (fields.written_summary_sent_at && !fields.repair_started_at) return 'awaiting_repair';
  if (fields.investigation_started_at && !fields.written_summary_sent_at) return 'summary_due';
  if (fields.investigation_started_at) return 'investigating';
  return 'awaiting_investigation';
}

// ── Hooks ───────────────────────────────────────────────────────────────

const AWAABS_SELECT = `
  id, org_id, title, description, category, priority, status, is_emergency,
  created_at, property_id,
  hazard_category, awaabs_law_applies, reported_at,
  investigation_started_at, investigation_due_by,
  written_summary_sent_at, written_summary_due_by,
  repair_started_at, repair_due_by, repair_completed_at,
  written_summary_text, escalation_level, breach_notified,
  property:properties(id, address_line, postcode),
  property_v2:properties_v2(id, address_line_1, city, postcode),
  tenant:tenants(id, first_name, last_name, email, phone),
  tenant_v2:tenants_v2(id, first_name, last_name, email, phone)
`;

/** Fetch all open maintenance requests that have Awaab's Law tracking. */
export function useActiveHazards() {
  return useQuery({
    queryKey: ['awaabs_law', 'active_hazards'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('maintenance_requests')
        .select(AWAABS_SELECT)
        .eq('awaabs_law_applies', true)
        .not('status', 'in', '("completed","verified","closed","cancelled")')
        .order('reported_at', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown[];
    },
    refetchInterval: 60_000, // Poll every minute for deadline accuracy
  });
}

/** Calculate all deadlines for a given maintenance request's Awaab's Law fields. */
export function useHazardDeadlines(request: AwaabsLawFields | null): HazardDeadlines | null {
  if (!request || !request.awaabs_law_applies || !request.reported_at || !request.hazard_category) {
    return null;
  }

  const reportedAt = new Date(request.reported_at);
  const category = request.hazard_category;

  const investigationStartedAt = request.investigation_started_at
    ? new Date(request.investigation_started_at)
    : null;

  const deadlines = calculateDeadlines(reportedAt, category, investigationStartedAt);

  const investigationDue = request.investigation_started_at ? null : deadlines.investigationDue;
  const writtenSummaryDue = deadlines.writtenSummaryDue && !request.written_summary_sent_at
    ? deadlines.writtenSummaryDue
    : null;
  const repairDue = request.repair_completed_at ? null : deadlines.repairDue;

  return {
    investigationDue,
    writtenSummaryDue,
    repairDue,
    investigationSeverity: investigationDue
      ? getDeadlineSeverity(investigationDue, reportedAt)
      : null,
    writtenSummarySeverity: writtenSummaryDue && investigationStartedAt
      ? getDeadlineSeverity(writtenSummaryDue, investigationStartedAt)
      : null,
    repairSeverity: repairDue
      ? getDeadlineSeverity(repairDue, reportedAt)
      : null,
    overallStatus: getTrackingStatus(request),
  };
}

/** Fetch Awaab's Law audit events for a specific request. */
export function useAwaabsLawEvents(requestId: string | undefined) {
  return useQuery({
    queryKey: ['awaabs_law', 'events', requestId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('awaabs_law_events')
        .select('*')
        .eq('maintenance_request_id', requestId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as AwaabsLawEvent[];
    },
    enabled: !!requestId,
  });
}

/** Log an immutable Awaab's Law event. */
async function logAwaabsEvent(
  maintenanceRequestId: string,
  orgId: string,
  eventType: AwaabsEventType,
  eventData: Record<string, unknown> = {}
) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabaseAny
    .from('awaabs_law_events')
    .insert({
      maintenance_request_id: maintenanceRequestId,
      org_id: orgId,
      event_type: eventType,
      event_data: eventData,
      performed_by: auth.user?.id ?? null,
    });
  if (error) console.error('Failed to log Awaab\'s Law event:', error);
}

/** Start investigation — logs timestamp and calculates written summary deadline. */
export function useStartInvestigation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const orgId = await fetchUserOrgId();
      const now = new Date();

      // Get current request to calculate deadlines
      const { data: _request, error: fetchErr } = await supabaseAny
        .from('maintenance_requests')
        .select('reported_at, hazard_category')
        .eq('id', requestId)
        .single();
      if (fetchErr) throw fetchErr;

      const writtenSummaryDue = addWorkingDays(now, 3);

      const { error } = await supabaseAny
        .from('maintenance_requests')
        .update({
          investigation_started_at: now.toISOString(),
          written_summary_due_by: writtenSummaryDue.toISOString(),
          status: 'triaged',
        })
        .eq('id', requestId);
      if (error) throw error;

      await logAwaabsEvent(requestId, orgId, 'investigation_started', {
        started_at: now.toISOString(),
        written_summary_due: writtenSummaryDue.toISOString(),
      });

      return { requestId, writtenSummaryDue };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: 'Investigation started', description: 'Written summary due within 3 working days.' });
    },
    onError: (err) => {
      toast({ title: 'Failed to start investigation', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

/** Send written summary to tenant — logs timestamp and summary text. */
export function useSendWrittenSummary() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ requestId, summaryText }: { requestId: string; summaryText: string }) => {
      const orgId = await fetchUserOrgId();
      const now = new Date();

      const { error } = await supabaseAny
        .from('maintenance_requests')
        .update({
          written_summary_sent_at: now.toISOString(),
          written_summary_text: summaryText,
        })
        .eq('id', requestId);
      if (error) throw error;

      await logAwaabsEvent(requestId, orgId, 'written_summary_sent', {
        sent_at: now.toISOString(),
        summary_length: summaryText.length,
      });

      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: 'Written summary sent', description: 'Tenant has been notified.' });
    },
    onError: (err) => {
      toast({ title: 'Failed to send summary', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

/** Start repair — logs repair commencement. */
export function useStartRepair() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const orgId = await fetchUserOrgId();
      const now = new Date();

      const { error } = await supabaseAny
        .from('maintenance_requests')
        .update({
          repair_started_at: now.toISOString(),
          status: 'in_progress',
        })
        .eq('id', requestId);
      if (error) throw error;

      await logAwaabsEvent(requestId, orgId, 'repair_started', {
        started_at: now.toISOString(),
      });

      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: 'Repair started' });
    },
    onError: (err) => {
      toast({ title: 'Failed to start repair', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

/** Complete repair — logs completion. */
export function useCompleteRepair() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (requestId: string) => {
      const orgId = await fetchUserOrgId();
      const now = new Date();

      const { error } = await supabaseAny
        .from('maintenance_requests')
        .update({
          repair_completed_at: now.toISOString(),
          status: 'completed',
        })
        .eq('id', requestId);
      if (error) throw error;

      await logAwaabsEvent(requestId, orgId, 'repair_completed', {
        completed_at: now.toISOString(),
      });

      // Notify org of completion
      createNotification({
        orgId,
        userId: 'all_org_members',
        category: 'maintenance',
        severity: 'success',
        title: 'Repair completed',
        message: `Awaab's Law repair has been completed for request ${requestId.slice(0, 8)}`,
        linkTo: `/maintenance/${requestId}`,
        entityType: 'maintenance_request',
        entityId: requestId,
      }).catch(console.error);

      return { requestId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: 'Repair completed', description: 'Awaab\'s Law obligations fulfilled.' });
    },
    onError: (err) => {
      toast({ title: 'Failed to complete repair', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

/** Classify or reclassify a hazard. */
export function useClassifyHazard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      requestId,
      hazardCategory,
    }: {
      requestId: string;
      hazardCategory: HazardCategory;
    }) => {
      const orgId = await fetchUserOrgId();

      // Get the request to recalculate deadlines
      const { data: request, error: fetchErr } = await supabaseAny
        .from('maintenance_requests')
        .select('reported_at, investigation_started_at')
        .eq('id', requestId)
        .single();
      if (fetchErr) throw fetchErr;

      const reportedAt = new Date(request.reported_at || new Date());
      const investigationStartedAt = request.investigation_started_at
        ? new Date(request.investigation_started_at)
        : null;

      const deadlines = calculateDeadlines(reportedAt, hazardCategory, investigationStartedAt);

      const { error } = await supabaseAny
        .from('maintenance_requests')
        .update({
          hazard_category: hazardCategory,
          investigation_due_by: deadlines.investigationDue.toISOString(),
          written_summary_due_by: deadlines.writtenSummaryDue?.toISOString() ?? null,
          repair_due_by: deadlines.repairDue.toISOString(),
        })
        .eq('id', requestId);
      if (error) throw error;

      await logAwaabsEvent(requestId, orgId, 'classification_changed', {
        new_category: hazardCategory,
        deadlines: {
          investigation: deadlines.investigationDue.toISOString(),
          repair: deadlines.repairDue.toISOString(),
        },
      });

      // Alert on emergency classification
      if (hazardCategory === 'emergency') {
        createNotification({
          orgId,
          userId: 'all_org_members',
          category: 'maintenance',
          severity: 'critical',
          title: 'Emergency hazard classified',
          message: 'A maintenance request has been classified as an emergency hazard. Repairs must begin within 24 hours.',
          linkTo: `/maintenance/${requestId}`,
          entityType: 'maintenance_request',
          entityId: requestId,
        }).catch(console.error);
      }

      return { requestId, hazardCategory };
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['awaabs_law'] });
      queryClient.invalidateQueries({ queryKey: ['maintenance_requests'] });
      toast({ title: 'Hazard classified', description: `Category: ${vars.hazardCategory}` });
    },
    onError: (err) => {
      toast({ title: 'Failed to classify hazard', description: (err as Error).message, variant: 'destructive' });
    },
  });
}

// ── Breach risk analysis ────────────────────────────────────────────────

export interface BreachRiskSummary {
  next24h: number;
  next48h: number;
  next5days: number;
  overdue: number;
  total: number;
}

export function useBreachRisk() {
  const { data: hazards } = useActiveHazards();

  if (!hazards || hazards.length === 0) {
    return { next24h: 0, next48h: 0, next5days: 0, overdue: 0, total: 0 } as BreachRiskSummary;
  }

  const now = new Date();
  let next24h = 0;
  let next48h = 0;
  let next5days = 0;
  let overdue = 0;

  for (const h of hazards) {
    const deadlinesToCheck = [
      h.investigation_due_by,
      h.written_summary_due_by,
      h.repair_due_by,
    ].filter(Boolean);

    for (const dStr of deadlinesToCheck) {
      const d = new Date(dStr);
      const hrsLeft = hoursRemaining(d, now);
      const wdLeft = workingDaysRemaining(d, now);

      if (hrsLeft <= 0) {
        overdue++;
      } else if (hrsLeft <= 24) {
        next24h++;
      } else if (hrsLeft <= 48) {
        next48h++;
      } else if (wdLeft <= 5) {
        next5days++;
      }
    }
  }

  return { next24h, next48h, next5days, overdue, total: hazards.length } as BreachRiskSummary;
}

// ── Compliance stats ────────────────────────────────────────────────────

export interface ComplianceStats {
  totalHazardsThisMonth: number;
  avgResponseTimeHours: number | null;
  breachCount: number;
  complianceRate: number;
}

export function useComplianceStats() {
  return useQuery({
    queryKey: ['awaabs_law', 'compliance_stats'],
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Fetch all hazards this month
      const { data: monthly, error: mErr } = await supabaseAny
        .from('maintenance_requests')
        .select('id, reported_at, investigation_started_at, repair_completed_at, escalation_level')
        .eq('awaabs_law_applies', true)
        .gte('reported_at', monthStart);
      if (mErr) throw mErr;

      type HazardRow = {
        id: string;
        reported_at: string | null;
        investigation_started_at: string | null;
        repair_completed_at: string | null;
        escalation_level: EscalationLevel;
      };
      const requests = (monthly || []) as HazardRow[];
      const totalHazards = requests.length;

      // Avg response time (reported → investigation started)
      const responseTimes = requests
        .filter((r) => r.investigation_started_at && r.reported_at)
        .map((r) => {
          const reported = new Date(r.reported_at!).getTime();
          const investigated = new Date(r.investigation_started_at!).getTime();
          return (investigated - reported) / (1000 * 60 * 60);
        });

      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null;

      // Breach count
      const breachCount = requests.filter((r) => r.escalation_level === 'breach').length;

      // Compliance rate
      const complianceRate = totalHazards > 0
        ? Math.round(((totalHazards - breachCount) / totalHazards) * 100)
        : 100;

      return {
        totalHazardsThisMonth: totalHazards,
        avgResponseTimeHours: avgResponseTime ? Math.round(avgResponseTime * 10) / 10 : null,
        breachCount,
        complianceRate,
      } as ComplianceStats;
    },
    refetchInterval: 60_000,
  });
}
