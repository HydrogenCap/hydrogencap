import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { computeRRBScore, type RRBScoreResult } from '@/lib/rrb/score';

export interface RRBReadinessRow {
  property_id: string;
  org_id: string;
  total_score: number;
  tenancy_score: number;
  deposit_score: number;
  rent_score: number;
  compliance_score: number;
  hmo_score: number;
  missing_data_count: number;
  last_calculated: string;
}

export interface RRBPortfolioSummary {
  averageScore: number;
  propertiesBelow80: number;
  totalProperties: number;
  rows: RRBReadinessRow[];
}

export function useRRBReadinessPortfolio() {
  return useQuery<RRBPortfolioSummary>({
    queryKey: ['rrb-readiness-portfolio'],
    queryFn: async () => {
      const { data, error } = await supabaseAny.from('rrb_readiness_v').select('*');
      if (error) throw error;
      const rows = (data || []) as RRBReadinessRow[];
      const totalProperties = rows.length;
      const averageScore =
        totalProperties === 0
          ? 0
          : Math.round(rows.reduce((s, r) => s + (r.total_score ?? 0), 0) / totalProperties);
      const propertiesBelow80 = rows.filter((r) => (r.total_score ?? 0) < 80).length;
      return { averageScore, propertiesBelow80, totalProperties, rows };
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface RRBPropertyReadiness extends RRBReadinessRow {
  missingData: string[];
}

export function useRRBReadinessProperty(propertyId: string | undefined) {
  return useQuery<RRBPropertyReadiness | null>({
    queryKey: ['rrb-readiness-property', propertyId],
    queryFn: async () => {
      if (!propertyId) return null;

      const [vRes, tRes, rRes, cRes, pRes] = await Promise.all([
        supabaseAny.from('rrb_readiness_v').select('*').eq('property_id', propertyId).maybeSingle(),
        supabaseAny
          .from('tenancy_agreements')
          .select('id, status, deposit_scheme, deposit_reference, is_periodic, break_clause_date, tenancy_type')
          .eq('property_id', propertyId),
        supabaseAny
          .from('rent_schedule')
          .select('tenancy_id, due_date, rent_amount, agreement_id'),
        supabaseAny
          .from('compliance_items')
          .select('compliance_type, expiry_date')
          .eq('property_id', propertyId),
        supabaseAny
          .from('properties_v2')
          .select('property_type, is_hmo_licensed, hmo_licence_number')
          .eq('id', propertyId)
          .maybeSingle(),
      ]);

      if (vRes.error) throw vRes.error;
      if (!vRes.data) return null;

      const tenancies = (tRes.data || []).map((t: { id: string; status: string; deposit_scheme: string | null; deposit_reference: string | null; is_periodic: boolean | null; break_clause_date: string | null; tenancy_type: string | null }) => ({
        id: t.id,
        status: t.status,
        deposit_protection_scheme: t.deposit_scheme,
        deposit_protection_id: t.deposit_reference,
        agreement_text:
          (t.is_periodic ? 'periodic ' : '') +
          (t.tenancy_type ?? '') +
          (t.break_clause_date ? ' break clause' : ''),
      }));
      const agreementIds = new Set((tRes.data || []).map((t: { id: string }) => t.id));
      const rent = (rRes.data || [])
        .filter((r: { agreement_id: string | null }) => !r.agreement_id || agreementIds.has(r.agreement_id))
        .map((r: { tenancy_id: string; due_date: string; rent_amount: number }) => ({
          tenancy_id: r.tenancy_id,
          due_date: r.due_date,
          rent_amount: Number(r.rent_amount),
        }));
      const compliance = (cRes.data || []).map((c: { compliance_type: string; expiry_date: string | null }) => ({
        type: c.compliance_type,
        expiry_date: c.expiry_date,
      }));
      const propertyType: string = pRes.data?.property_type ?? '';
      const isHmo = propertyType.toLowerCase().includes('hmo');
      const hasActiveLicence = !!pRes.data?.is_hmo_licensed && !!pRes.data?.hmo_licence_number;

      const computed: RRBScoreResult = computeRRBScore({
        tenancies,
        rentSchedule: rent,
        compliance,
        hmo: { is_hmo: isHmo, has_active_licence: hasActiveLicence, licence_type_matches: true },
      });

      return {
        ...(vRes.data as RRBReadinessRow),
        missingData: computed.missingData,
      };
    },
    enabled: !!propertyId,
    staleTime: 1000 * 60 * 5,
  });
}
