import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from './useUserOrg';
import { useToast } from '@/hooks/use-toast';

// ── Types ───────────────────────────────────────────────────────────────

export type DealStage =
  | 'sourced'
  | 'analysed'
  | 'viewing_booked'
  | 'viewed'
  | 'offer_made'
  | 'offer_accepted'
  | 'due_diligence'
  | 'exchanged'
  | 'completed'
  | 'withdrawn'
  | 'rejected';

export const DEAL_STAGE_ORDER: DealStage[] = [
  'sourced',
  'analysed',
  'viewing_booked',
  'viewed',
  'offer_made',
  'offer_accepted',
  'due_diligence',
  'exchanged',
  'completed',
];

export const DEAL_STAGE_LABELS: Record<DealStage, string> = {
  sourced: 'Sourced',
  analysed: 'Analysed',
  viewing_booked: 'Viewing Booked',
  viewed: 'Viewed',
  offer_made: 'Offer Made',
  offer_accepted: 'Offer Accepted',
  due_diligence: 'Due Diligence',
  exchanged: 'Exchanged',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
};

export const KANBAN_DEAL_STAGES = DEAL_STAGE_ORDER.filter(
  s => s !== 'completed'
) as DealStage[];

export type ListingSource =
  | 'rightmove'
  | 'zoopla'
  | 'onthemarket'
  | 'openrent'
  | 'auction'
  | 'agent_direct'
  | 'off_market'
  | 'other';

export const LISTING_SOURCE_LABELS: Record<ListingSource, string> = {
  rightmove: 'Rightmove',
  zoopla: 'Zoopla',
  onthemarket: 'OnTheMarket',
  openrent: 'OpenRent',
  auction: 'Auction',
  agent_direct: 'Agent Direct',
  off_market: 'Off Market',
  other: 'Other',
};

export type OfferResponse = 'pending' | 'accepted' | 'rejected' | 'countered';

export interface DealPipelineItem {
  id: string;
  org_id: string;
  address: string;
  postcode: string | null;
  listing_url: string | null;
  listing_source: ListingSource | null;
  asking_price: number | null;
  offer_amount: number | null;
  property_type: string | null;
  beds: number | null;
  stage: DealStage;
  estimated_rental: number | null;
  estimated_yield: number | null;
  estimated_refurb: number | null;
  ai_analysis_id: string | null;
  investment_score: number | null;
  offer_date: string | null;
  offer_response: OfferResponse | null;
  counter_offer_amount: number | null;
  viewing_date: string | null;
  exchange_date: string | null;
  completion_date: string | null;
  agent_name: string | null;
  agent_company: string | null;
  agent_phone: string | null;
  agent_email: string | null;
  notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export type DealPipelineInsert = Pick<DealPipelineItem, 'address'> &
  Partial<
    Omit<DealPipelineItem, 'id' | 'org_id' | 'created_at' | 'updated_at'>
  >;

export type DealPipelineUpdate = Partial<
  Omit<DealPipelineItem, 'id' | 'org_id' | 'created_at' | 'updated_at'>
>;

export type DDCategory =
  | 'legal'
  | 'survey'
  | 'financial'
  | 'compliance'
  | 'planning'
  | 'environmental';

export type DDStatus = 'pending' | 'in_progress' | 'passed' | 'failed' | 'n/a';

export interface DueDiligenceItem {
  id: string;
  deal_id: string;
  category: DDCategory;
  item_name: string;
  status: DDStatus;
  assigned_to: string | null;
  due_date: string | null;
  cost: number | null;
  notes: string | null;
  document_url: string | null;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
}

export type DDItemUpdate = Partial<
  Omit<DueDiligenceItem, 'id' | 'deal_id' | 'created_at'>
>;

// ── Default DD checklist template ───────────────────────────────────────

export const DD_TEMPLATE: { category: DDCategory; item_name: string; sort_order: number }[] = [
  // Legal
  { category: 'legal', item_name: 'Title search / Land Registry check', sort_order: 1 },
  { category: 'legal', item_name: 'Lease review (if leasehold)', sort_order: 2 },
  { category: 'legal', item_name: 'Planning permission history', sort_order: 3 },
  { category: 'legal', item_name: 'Restrictive covenants check', sort_order: 4 },
  { category: 'legal', item_name: 'Boundary disputes check', sort_order: 5 },
  // Survey
  { category: 'survey', item_name: 'RICS Level 2/3 survey', sort_order: 6 },
  { category: 'survey', item_name: 'Specialist reports (damp, structural, roof)', sort_order: 7 },
  { category: 'survey', item_name: 'Drainage survey', sort_order: 8 },
  // Financial
  { category: 'financial', item_name: 'Mortgage AIP/DIP', sort_order: 9 },
  { category: 'financial', item_name: 'SDLT calculation (with additional property surcharge)', sort_order: 10 },
  { category: 'financial', item_name: 'Refurbishment cost estimate', sort_order: 11 },
  { category: 'financial', item_name: 'Cashflow projection', sort_order: 12 },
  // Compliance
  { category: 'compliance', item_name: 'EPC rating check', sort_order: 13 },
  { category: 'compliance', item_name: 'HMO licence required?', sort_order: 14 },
  { category: 'compliance', item_name: 'Selective licensing area?', sort_order: 15 },
  { category: 'compliance', item_name: 'Article 4 direction?', sort_order: 16 },
  { category: 'compliance', item_name: 'Fire risk assessment needed?', sort_order: 17 },
  // Environmental
  { category: 'environmental', item_name: 'Flood risk zone check', sort_order: 18 },
  { category: 'environmental', item_name: 'Ground contamination', sort_order: 19 },
  { category: 'environmental', item_name: 'Japanese knotweed survey', sort_order: 20 },
];

// ── Hooks ───────────────────────────────────────────────────────────────

export interface DealFilters {
  source?: ListingSource;
  propertyType?: string;
  minPrice?: number;
  maxPrice?: number;
  stages?: DealStage[];
}

export function useDeals(filters?: DealFilters) {
  return useQuery({
    queryKey: ['deal-pipeline', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('deal_pipeline')
        .select('*')
        .order('created_at', { ascending: true });

      if (filters?.source) {
        query = query.eq('listing_source', filters.source);
      }
      if (filters?.propertyType) {
        query = query.eq('property_type', filters.propertyType);
      }
      if (filters?.minPrice) {
        query = query.gte('asking_price', filters.minPrice);
      }
      if (filters?.maxPrice) {
        query = query.lte('asking_price', filters.maxPrice);
      }
      if (filters?.stages && filters.stages.length > 0) {
        query = query.in('stage', filters.stages);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as DealPipelineItem[];
    },
  });
}

export function useCreateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: DealPipelineInsert) => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('deal_pipeline')
        .insert({
          org_id: orgId,
          address: input.address,
          postcode: input.postcode || null,
          listing_url: input.listing_url || null,
          listing_source: input.listing_source || null,
          asking_price: input.asking_price || null,
          offer_amount: input.offer_amount || null,
          property_type: input.property_type || null,
          beds: input.beds || null,
          stage: input.stage || 'sourced',
          estimated_rental: input.estimated_rental || null,
          estimated_yield: input.estimated_yield || null,
          estimated_refurb: input.estimated_refurb || null,
          agent_name: input.agent_name || null,
          agent_company: input.agent_company || null,
          agent_phone: input.agent_phone || null,
          agent_email: input.agent_email || null,
          notes: input.notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DealPipelineItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-pipeline'] });
      toast({ title: 'Deal added to pipeline' });
    },
  });
}

export function useUpdateDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DealPipelineUpdate }) => {
      const { data, error } = await supabaseAny
        .from('deal_pipeline')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DealPipelineItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-pipeline'] });
      toast({ title: 'Deal updated' });
    },
  });
}

export function useUpdateDealStage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, stage, updates }: {
      id: string;
      stage: DealStage;
      updates?: DealPipelineUpdate;
    }) => {
      const { data, error } = await supabaseAny
        .from('deal_pipeline')
        .update({ stage, ...updates })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      // Auto-create DD items when entering due_diligence
      if (stage === 'due_diligence') {
        const { data: existing } = await supabaseAny
          .from('due_diligence_items')
          .select('id')
          .eq('deal_id', id)
          .limit(1);

        if (!existing || existing.length === 0) {
          const items = DD_TEMPLATE.map(t => ({
            deal_id: id,
            category: t.category,
            item_name: t.item_name,
            sort_order: t.sort_order,
            status: 'pending',
          }));
          await supabaseAny.from('due_diligence_items').insert(items);
        }
      }

      return data as DealPipelineItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deal-pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['due-diligence'] });
      toast({ title: `Moved to ${DEAL_STAGE_LABELS[data.stage]}` });
    },
  });
}

export function useDueDiligenceItems(dealId: string | null) {
  return useQuery({
    queryKey: ['due-diligence', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('due_diligence_items')
        .select('*')
        .eq('deal_id', dealId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as DueDiligenceItem[];
    },
  });
}

export function useUpdateDDItem() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: DDItemUpdate }) => {
      const finalUpdates = { ...updates };
      if (updates.status === 'passed' || updates.status === 'failed') {
        finalUpdates.completed_at = new Date().toISOString();
      }
      const { data, error } = await supabaseAny
        .from('due_diligence_items')
        .update(finalUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DueDiligenceItem;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['due-diligence', data.deal_id] });
      toast({ title: 'Checklist item updated' });
    },
  });
}

export function useCompleteDeal() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, completionDate }: { id: string; completionDate?: string }) => {
      const { data, error } = await supabaseAny
        .from('deal_pipeline')
        .update({
          stage: 'completed',
          completion_date: completionDate || new Date().toISOString().slice(0, 10),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as DealPipelineItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deal-pipeline'] });
      toast({ title: 'Deal completed! Ready for onboarding.' });
    },
  });
}

export function useDealStats() {
  const { data: deals } = useDeals();

  const stats = {
    totalInPipeline: 0,
    totalValue: 0,
    avgYield: 0,
    conversionRate: 0,
  };

  if (!deals || deals.length === 0) return stats;

  const active = deals.filter(d => !['completed', 'withdrawn', 'rejected'].includes(d.stage));
  const completed = deals.filter(d => d.stage === 'completed');
  const yieldsWithValues = active
    .map(d => d.estimated_yield)
    .filter((y): y is number => y != null && y > 0);

  stats.totalInPipeline = active.length;
  stats.totalValue = active.reduce((sum, d) => sum + (d.asking_price || 0), 0);
  stats.avgYield = yieldsWithValues.length > 0
    ? yieldsWithValues.reduce((a, b) => a + b, 0) / yieldsWithValues.length
    : 0;
  stats.conversionRate = deals.length > 0
    ? (completed.length / deals.length) * 100
    : 0;

  return stats;
}
