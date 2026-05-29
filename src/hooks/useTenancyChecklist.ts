import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import {
  generateChecklistDefinitions,
  buildTenancyChecklist,
  getChecklistSummary,
  groupByCategory,
  type ChecklistItem,
  type ChecklistSummary,
  type ChecklistCategory,
  type ComplianceData,
  type PropertyContext,
} from '@/lib/tenancy-checklist';
import type { ComplianceDocType } from '@/lib/complianceV2Types';
import { toast } from "sonner";

// ─── useTenancyChecklist ─────────────────────────────────────

interface TenancyChecklistResult {
  items: ChecklistItem[];
  grouped: Record<ChecklistCategory, ChecklistItem[]>;
  summary: ChecklistSummary;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Generates and resolves a tenancy compliance checklist.
 * Accepts a tenancy agreement ID (used throughout the V2 UI).
 * Auto-checks items against compliance documents and agreement fields.
 */
export function useTenancyChecklist(tenancyId: string | undefined): TenancyChecklistResult {
  // Fetch tenancy agreement with property context
  const { data: agreementData, isLoading: agreementLoading, error: agreementError } = useQuery({
    queryKey: ['tenancy-checklist-agreement', tenancyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_agreements')
        .select(`
          id, org_id, property_id, room_id, tenant_id, start_date,
          deposit_amount, deposit_scheme, deposit_protected_date,
          how_to_rent_served_date, prescribed_info_served_date, status,
          properties_v2!inner(id, property_type, address_line_1, postcode)
        `)
        .eq('id', tenancyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });

  // Fetch compliance documents for the property
  const propertyId = agreementData?.property_id;
  const { data: complianceDocs, isLoading: complianceLoading } = useQuery({
    queryKey: ['tenancy-checklist-compliance', propertyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('compliance_documents_v2')
        .select('document_type, status, expiry_date')
        .eq('property_id', propertyId!)
        .eq('is_current', true);
      if (error) throw error;
      return data;
    },
    enabled: !!propertyId,
  });

  // Fetch existing manual checklist items (tenancy_compliance_items uses tenancy_id)
  const { data: existingItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['tenancy-compliance', tenancyId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_compliance_items')
        .select('*')
        .eq('tenancy_id', tenancyId!);
      if (error) throw error;
      return data;
    },
    enabled: !!tenancyId,
  });

  const isLoading = agreementLoading || complianceLoading || itemsLoading;

  const result = useMemo(() => {
    if (!agreementData || isLoading) {
      return {
        items: [],
        grouped: { safety: [], legal: [], financial: [], documentation: [] },
        summary: { total: 0, completed: 0, pending: 0, overdue: 0, completionRate: 100 },
      };
    }

    // Determine property context
    const property = agreementData.properties_v2 as unknown as {
      id: string;
      property_type: string | null;
      address_line_1: string | null;
      postcode: string | null;
    };
    const propertyType = property?.property_type?.toLowerCase() || '';
    const context: PropertyContext = {
      property_type: property?.property_type,
      is_hmo: propertyType.includes('hmo'),
      is_selective_area: false,
    };

    // Check if any selective licence exists for this property
    const hasSelectiveLicence = complianceDocs?.some(
      (d) => d.document_type === 'selective_licence'
    );
    if (hasSelectiveLicence) {
      context.is_selective_area = true;
    }

    // Generate definitions
    const definitions = generateChecklistDefinitions(context);

    // Build compliance data map
    const documents = new Map<ComplianceDocType, { status: string; expiry_date: string | null }>();
    for (const doc of complianceDocs || []) {
      documents.set(doc.document_type as ComplianceDocType, {
        status: doc.status || 'missing',
        expiry_date: doc.expiry_date,
      });
    }

    // Build tenancy fields from agreement data
    const tenancyFields: Record<string, string | null> = {
      deposit_protected_date: agreementData.deposit_protected_date,
      prescribed_info_served_date: agreementData.prescribed_info_served_date,
      how_to_rent_served_date: agreementData.how_to_rent_served_date,
    };

    const complianceData: ComplianceData = { documents, tenancyFields };

    // Build existing items map
    const existingMap = new Map<string, {
      completed_date: string | null;
      completed_by: string | null;
      notes: string | null;
      document_url: string | null;
    }>();
    for (const item of existingItems || []) {
      existingMap.set(item.item_type, {
        completed_date: item.completed_date,
        completed_by: item.completed_by,
        notes: item.notes,
        document_url: item.document_url,
      });
    }

    const items = buildTenancyChecklist(
      definitions,
      complianceData,
      existingMap,
      agreementData.start_date,
    );
    const grouped = groupByCategory(items);
    const summary = getChecklistSummary(items);

    return { items, grouped, summary };
  }, [agreementData, complianceDocs, existingItems, isLoading]);

  return {
    ...result,
    isLoading,
    error: agreementError as Error | null,
  };
}

// ─── useMarkChecklistItem ────────────────────────────────────

interface MarkItemInput {
  tenancyId: string;
  itemType: string;
  label: string;
  orgId: string;
  notes?: string;
  documentUrl?: string;
}

export function useMarkChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenancyId, itemType, label, orgId, notes, documentUrl }: MarkItemInput) => {
      const { data: { user } } = await supabase.auth.getUser();

      // Check if existing item exists
      const { data: existing } = await supabaseAny
        .from('tenancy_compliance_items')
        .select('id')
        .eq('tenancy_id', tenancyId)
        .eq('item_type', itemType)
        .maybeSingle();

      const today = new Date().toISOString().split('T')[0];

      if (existing) {
        const { error } = await supabaseAny
          .from('tenancy_compliance_items')
          .update({
            completed_date: today,
            completed_by: user?.email || 'Unknown',
            notes: notes || null,
            document_url: documentUrl || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabaseAny
          .from('tenancy_compliance_items')
          .insert({
            tenancy_id: tenancyId,
            org_id: orgId,
            item_type: itemType,
            label,
            is_required: true,
            is_applicable: true,
            completed_date: today,
            completed_by: user?.email || 'Unknown',
            notes: notes || null,
            document_url: documentUrl || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance', variables.tenancyId] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-checklist-stats'] });
      toast.success('Item marked complete');
    },
    onError: (err) => {
      toast.error('Failed to update', { description: (err as Error).message });
    },
  });
}

// ─── useUnmarkChecklistItem ──────────────────────────────────

export function useUnmarkChecklistItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ tenancyId, itemType }: { tenancyId: string; itemType: string }) => {
      const { error } = await supabaseAny
        .from('tenancy_compliance_items')
        .update({
          completed_date: null,
          completed_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq('tenancy_id', tenancyId)
        .eq('item_type', itemType);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance', variables.tenancyId] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-compliance-stats'] });
      queryClient.invalidateQueries({ queryKey: ['tenancy-checklist-stats'] });
    },
  });
}

// ─── useTenancyChecklistStats (portfolio-wide) ───────────────

export interface TenancyChecklistPortfolioStats {
  totalTenancies: number;
  fullyCompliant: number;
  partiallyCompliant: number;
  nonCompliant: number;
  overallCompletionRate: number;
  overdueItems: number;
}

export function useTenancyChecklistStats() {
  return useQuery({
    queryKey: ['tenancy-checklist-stats'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('tenancy_compliance_items')
        .select('*')
        .eq('is_applicable', true)
        .eq('is_required', true);

      if (error) throw error;

      const items = (data || []) as Array<{
        completed_date: string | null;
        due_date: string | null;
        tenancy_id: string;
      }>;

      const today = new Date().toISOString().split('T')[0];

      // Group by tenancy
      const byTenancy = new Map<string, { total: number; completed: number }>();
      for (const item of items) {
        const tid = item.tenancy_id;
        if (!byTenancy.has(tid)) {
          byTenancy.set(tid, { total: 0, completed: 0 });
        }
        const entry = byTenancy.get(tid)!;
        entry.total++;
        if (item.completed_date) entry.completed++;
      }

      const totalTenancies = byTenancy.size;
      let fullyCompliant = 0;
      let partiallyCompliant = 0;
      let nonCompliant = 0;

      for (const [, entry] of byTenancy) {
        const rate = entry.total > 0 ? entry.completed / entry.total : 1;
        if (rate === 1) fullyCompliant++;
        else if (rate > 0) partiallyCompliant++;
        else nonCompliant++;
      }

      const totalItemCount = items.length;
      const completedItemCount = items.filter((i) => i.completed_date).length;
      const overdueItems = items.filter(
        (i) => !i.completed_date && i.due_date && i.due_date < today
      ).length;

      return {
        totalTenancies,
        fullyCompliant,
        partiallyCompliant,
        nonCompliant,
        overallCompletionRate: totalItemCount > 0 ? Math.round((completedItemCount / totalItemCount) * 100) : 100,
        overdueItems,
      } satisfies TenancyChecklistPortfolioStats;
    },
  });
}
