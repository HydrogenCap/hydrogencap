 import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
 import { supabase } from '@/integrations/supabase/client';
 import { useToast } from '@/hooks/use-toast';
 
 export interface PropertyValuation {
   id: string;
   property_id: string;
   estimated_value_gbp: number;
   confidence_level: 'high' | 'medium' | 'low';
   valuation_method: string;
   comparables_count: number;
   comparables_avg_price: number;
   adjustment_factors: Record<string, number>;
   valuation_date: string;
   notes: string;
 }
 
 export interface ComparableSale {
   id: string;
   address: string;
   postcode: string;
   price_paid: number;
   sale_date: string;
   property_type: string;
   new_build: boolean;
   tenure: string;
   distance_meters: number;
 }
 
 export interface ValuationAlert {
   id: string;
   property_id: string;
   alert_type: 'value_increase' | 'value_decrease' | 'refinance_opportunity' | 'comparable_sale';
   recorded_value_gbp: number;
   estimated_value_gbp: number;
   change_percent: number;
   title: string;
   message: string;
   is_read: boolean;
   created_at: string;
   property?: {
     address_line: string;
   };
 }
 
export interface RefinancingOpportunity {
   id: string;
   property_id: string;
   current_value_gbp: number;
   current_mortgage_gbp: number;
   current_ltv: number;
   potential_release_gbp: number;
   status: 'identified' | 'under_review' | 'in_progress' | 'completed' | 'dismissed';
   property?: {
     address_line: string;
     postcode: string;
   };
 }

type RefinancingStatus = RefinancingOpportunity['status'];

interface RefinancingOpportunityUpdate {
  status: RefinancingStatus;
  updated_at: string;
  reviewed_at?: string;
  completed_at?: string;
  notes?: string;
}
 
 // Get valuation history for a property
 export function usePropertyValuationHistory(propertyId: string | undefined) {
   return useQuery({
     queryKey: ['property-valuations', propertyId],
     queryFn: async () => {
       if (!propertyId) return [];
       
       const { data, error } = await (supabase as any)
         .from('property_valuations')
         .select('*')
         .eq('property_id', propertyId)
         .order('valuation_date', { ascending: false });
       
       if (error) throw error;
       return data as PropertyValuation[];
     },
     enabled: !!propertyId,
   });
 }
 
 // Get comparables for a property
 export function usePropertyComparables(propertyId: string | undefined) {
   return useQuery({
     queryKey: ['property-comparables', propertyId],
     queryFn: async () => {
       if (!propertyId) return [];
       
       const { data, error } = await (supabase as any)
         .from('comparable_sales')
         .select('*')
         .eq('source_property_id', propertyId)
         .order('sale_date', { ascending: false })
         .limit(20);
       
       if (error) throw error;
       return data as ComparableSale[];
     },
     enabled: !!propertyId,
   });
 }
 
 // Get all valuation alerts
 export function useValuationAlerts() {
   return useQuery({
     queryKey: ['valuation-alerts'],
     queryFn: async () => {
       const { data, error } = await (supabase as any)
         .from('valuation_alerts')
         .select(`
           *,
           property:properties(address_line)
         `)
         .eq('is_dismissed', false)
         .order('created_at', { ascending: false })
         .limit(50);
       
       if (error) throw error;
       return data as ValuationAlert[];
     },
   });
 }
 
 // Get unread alert count
 export function useUnreadAlertCount() {
   return useQuery({
     queryKey: ['valuation-alerts-unread-count'],
     queryFn: async () => {
       const { count, error } = await (supabase as any)
         .from('valuation_alerts')
         .select('*', { count: 'exact', head: true })
         .eq('is_read', false)
         .eq('is_dismissed', false);
       
       if (error) throw error;
       return count || 0;
     },
   });
 }
 
 // Get refinancing opportunities
 export function useRefinancingOpportunities() {
   return useQuery({
     queryKey: ['refinancing-opportunities'],
     queryFn: async () => {
       const { data, error } = await (supabase as any)
         .from('refinancing_opportunities')
         .select(`
           *,
           property:properties(address_line, postcode)
         `)
         .in('status', ['identified', 'under_review'])
         .order('potential_release_gbp', { ascending: false });
       
       if (error) throw error;
       return data as RefinancingOpportunity[];
     },
   });
 }
 
 // Trigger valuation for a property
 export function useTriggerValuation() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
   return useMutation({
     mutationFn: async (propertyId: string) => {
       // First fetch comparables
       const compResponse = await supabase.functions.invoke('fetch-land-registry-comparables', {
         body: { propertyId },
       });
       
       if (compResponse.error) throw compResponse.error;
 
       // Then generate valuation
       const valResponse = await supabase.functions.invoke('generate-ai-valuation', {
         body: { propertyId },
       });
       
       if (valResponse.error) throw valResponse.error;
       
       return valResponse.data;
     },
     onSuccess: (data, propertyId) => {
       queryClient.invalidateQueries({ queryKey: ['property-valuations', propertyId] });
       queryClient.invalidateQueries({ queryKey: ['property-comparables', propertyId] });
       queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });

       toast({
         title: 'Valuation Complete',
         description: `Estimated value: £${data?.valuation?.estimated_value?.toLocaleString()} (${data?.valuation?.confidence} confidence)`,
       });
     },
     onError: (error) => {
       toast({
         title: 'Valuation Failed',
         description: error.message,
         variant: 'destructive',
       });
     },
   });
 }
 
 // Mark alert as read
 export function useMarkAlertRead() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (alertId: string) => {
       const { error } = await (supabase as any)
         .from('valuation_alerts')
         .update({ is_read: true })
         .eq('id', alertId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });
       queryClient.invalidateQueries({ queryKey: ['valuation-alerts-unread-count'] });
     },
   });
 }
 
 // Dismiss alert
 export function useDismissAlert() {
   const queryClient = useQueryClient();
 
   return useMutation({
     mutationFn: async (alertId: string) => {
       const { error } = await (supabase as any)
         .from('valuation_alerts')
         .update({ is_dismissed: true })
         .eq('id', alertId);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['valuation-alerts'] });
       queryClient.invalidateQueries({ queryKey: ['valuation-alerts-unread-count'] });
     },
   });
 }
 
 // Update refinancing opportunity status
 export function useUpdateRefinancingStatus() {
   const queryClient = useQueryClient();
   const { toast } = useToast();
 
  return useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: RefinancingStatus; notes?: string }) => {
      const updates: RefinancingOpportunityUpdate = { status, updated_at: new Date().toISOString() };
      if (status === 'under_review') updates.reviewed_at = new Date().toISOString();
      if (status === 'completed') updates.completed_at = new Date().toISOString();
      if (notes) updates.notes = notes;
 
       const { error } = await (supabase as any)
         .from('refinancing_opportunities')
         .update(updates)
         .eq('id', id);
       
       if (error) throw error;
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ['refinancing-opportunities'] });
       toast({ title: 'Status updated' });
     },
   });
 }
