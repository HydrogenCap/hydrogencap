import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────

export type InspectionType = 'periodic' | 'check_in' | 'check_out' | 'mid_tenancy' | 'pre_let' | 'inventory' | 'ad_hoc';
export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
export type ItemCondition = ConditionRating | 'n/a';

export interface PropertyInspection {
  id: string;
  org_id: string;
  property_id: string;
  inspection_type: InspectionType;
  status: InspectionStatus;
  scheduled_date: string;
  scheduled_time: string | null;
  completed_at: string | null;
  inspector_name: string | null;
  tenant_notified: boolean;
  tenant_present: boolean | null;
  access_notes: string | null;
  overall_condition: ConditionRating | null;
  summary: string | null;
  follow_up_actions: FollowUpAction[];
  created_at: string;
}

export interface FollowUpAction {
  description: string;
  priority: 'low' | 'medium' | 'high';
  assigned_to?: string;
  due_date?: string;
}

export interface InspectionItemPhoto {
  url: string;
  description?: string;
  taken_at?: string;
}

export interface InspectionItem {
  id: string;
  inspection_id: string;
  room_name: string;
  item_name: string;
  condition: ItemCondition | null;
  notes: string | null;
  photos: InspectionItemPhoto[];
  action_required: boolean;
  action_description: string | null;
  sort_order: number;
}

export interface InspectionTemplateRoom {
  room_name: string;
  items: { item_name: string; sort_order: number }[];
}

export interface InspectionTemplate {
  id: string;
  org_id: string;
  name: string;
  inspection_type: string;
  rooms: InspectionTemplateRoom[];
  created_at: string;
}

export interface InspectionWithProperty extends PropertyInspection {
  property?: { id: string; address_line_1: string; city: string; postcode: string } | null;
}

// ─── Constants ──────────────────────────────────────────────────────

export const INSPECTION_TYPES: { value: InspectionType; label: string }[] = [
  { value: 'periodic', label: 'Periodic' },
  { value: 'check_in', label: 'Check-In' },
  { value: 'check_out', label: 'Check-Out' },
  { value: 'mid_tenancy', label: 'Mid-Tenancy' },
  { value: 'pre_let', label: 'Pre-Let' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'ad_hoc', label: 'Ad Hoc' },
];

export const CONDITION_RATINGS: { value: ItemCondition; label: string; color: string }[] = [
  { value: 'excellent', label: 'Excellent', color: 'bg-emerald-500/10 text-emerald-700' },
  { value: 'good', label: 'Good', color: 'bg-green-500/10 text-green-700' },
  { value: 'fair', label: 'Fair', color: 'bg-yellow-500/10 text-yellow-700' },
  { value: 'poor', label: 'Poor', color: 'bg-orange-500/10 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-500/10 text-red-700' },
  { value: 'n/a', label: 'N/A', color: 'bg-muted text-muted-foreground' },
];

export const OVERALL_CONDITIONS: { value: ConditionRating; label: string }[] = [
  { value: 'excellent', label: 'Excellent' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
  { value: 'critical', label: 'Critical' },
];

// ─── Hooks ──────────────────────────────────────────────────────────

export function useInspections(filters?: {
  status?: InspectionStatus;
  propertyId?: string;
  inspectionType?: InspectionType;
}) {
  return useQuery({
    queryKey: ['inspections', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from('property_inspections')
        .select('*, property:properties_v2(id, address_line_1, city, postcode)')
        .order('scheduled_date', { ascending: false });

      if (filters?.status) query = query.eq('status', filters.status);
      if (filters?.propertyId) query = query.eq('property_id', filters.propertyId);
      if (filters?.inspectionType) query = query.eq('inspection_type', filters.inspectionType);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as InspectionWithProperty[];
    },
  });
}

export function useInspection(id: string | undefined) {
  return useQuery({
    queryKey: ['inspection', id],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('property_inspections')
        .select('*, property:properties_v2(id, address_line_1, city, postcode)')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as unknown as InspectionWithProperty;
    },
    enabled: !!id,
  });
}

export function useCreateInspection() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async (inspection: {
      property_id: string;
      inspection_type: InspectionType;
      scheduled_date: string;
      scheduled_time?: string | null;
      inspector_name?: string | null;
      tenant_notified?: boolean;
      access_notes?: string | null;
    }) => {
      const { data, error } = await supabaseAny
        .from('property_inspections')
        .insert({ ...inspection, org_id: org!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspections'] });
      toast.success('Inspection scheduled');
    },
    onError: (error: Error) => {
      toast.error('Failed to schedule inspection', { description: error.message });
    },
  });
}

export function useUpdateInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PropertyInspection> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('property_inspections')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inspections'] });
      qc.invalidateQueries({ queryKey: ['inspection', vars.id] });
      toast.success('Inspection updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update inspection', { description: error.message });
    },
  });
}

export function useCompleteInspection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, overall_condition, summary, follow_up_actions }: {
      id: string;
      overall_condition: ConditionRating;
      summary: string;
      follow_up_actions?: FollowUpAction[];
    }) => {
      const { data, error } = await supabaseAny
        .from('property_inspections')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          overall_condition,
          summary,
          follow_up_actions: follow_up_actions || [],
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inspections'] });
      qc.invalidateQueries({ queryKey: ['inspection', vars.id] });
      toast.success('Inspection completed');
    },
    onError: (error: Error) => {
      toast.error('Failed to complete inspection', { description: error.message });
    },
  });
}

// ─── Inspection Items ───────────────────────────────────────────────

export function useInspectionItems(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ['inspection_items', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('inspection_items')
        .select('*')
        .eq('inspection_id', inspectionId!)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as InspectionItem[];
    },
    enabled: !!inspectionId,
  });
}

export function useCreateInspectionItems() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (items: Omit<InspectionItem, 'id'>[]) => {
      const { data, error } = await supabaseAny
        .from('inspection_items')
        .insert(items)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      if (vars.length > 0) {
        qc.invalidateQueries({ queryKey: ['inspection_items', vars[0].inspection_id] });
      }
    },
  });
}

export function useUpdateInspectionItem() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InspectionItem> & { id: string; inspection_id: string }) => {
      const { data, error } = await supabaseAny
        .from('inspection_items')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['inspection_items', vars.inspection_id] });
    },
  });
}

// ─── Templates ──────────────────────────────────────────────────────

export function useInspectionTemplates() {
  return useQuery({
    queryKey: ['inspection_templates'],
    queryFn: async () => {
      const { data, error } = await supabaseAny
        .from('inspection_templates')
        .select('*')
        .order('name');
      if (error) throw error;
      return (data || []) as unknown as InspectionTemplate[];
    },
  });
}

export function useCreateInspectionTemplate() {
  const qc = useQueryClient();
  const { data: org } = useOrganization();
  return useMutation({
    mutationFn: async (template: { name: string; inspection_type: string; rooms: InspectionTemplateRoom[] }) => {
      const { data, error } = await supabaseAny
        .from('inspection_templates')
        .insert({ ...template, org_id: org!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection_templates'] });
      toast.success('Template created');
    },
    onError: (error: Error) => {
      toast.error('Failed to create template', { description: error.message });
    },
  });
}

export function useUpdateInspectionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InspectionTemplate> & { id: string }) => {
      const { data, error } = await supabaseAny
        .from('inspection_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection_templates'] });
      toast.success('Template updated');
    },
    onError: (error: Error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });
}

export function useDeleteInspectionTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabaseAny
        .from('inspection_templates')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inspection_templates'] });
      toast.success('Template deleted');
    },
    onError: (error: Error) => {
      toast.error('Failed to delete template', { description: error.message });
    },
  });
}

// ─── Default templates ──────────────────────────────────────────────

export const DEFAULT_TEMPLATES: Omit<InspectionTemplate, 'id' | 'org_id' | 'created_at'>[] = [
  {
    name: 'Standard HMO Inspection',
    inspection_type: 'periodic',
    rooms: [
      { room_name: 'Communal Hallway', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor', sort_order: 2 }, { item_name: 'Lighting', sort_order: 3 }, { item_name: 'Fire Equipment', sort_order: 4 }, { item_name: 'Smoke Alarms', sort_order: 5 }] },
      { room_name: 'Kitchen', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor', sort_order: 2 }, { item_name: 'Windows', sort_order: 3 }, { item_name: 'Doors', sort_order: 4 }, { item_name: 'Worktops', sort_order: 5 }, { item_name: 'Sink & Taps', sort_order: 6 }, { item_name: 'Cooker/Hob', sort_order: 7 }, { item_name: 'Fridge/Freezer', sort_order: 8 }, { item_name: 'Washing Machine', sort_order: 9 }, { item_name: 'Extraction Fan', sort_order: 10 }, { item_name: 'Cupboards', sort_order: 11 }] },
      { room_name: 'Bathroom', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor', sort_order: 2 }, { item_name: 'Windows', sort_order: 3 }, { item_name: 'Bath/Shower', sort_order: 4 }, { item_name: 'Toilet', sort_order: 5 }, { item_name: 'Basin & Taps', sort_order: 6 }, { item_name: 'Extraction Fan', sort_order: 7 }, { item_name: 'Sealant', sort_order: 8 }] },
      { room_name: 'Bedroom 1', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor', sort_order: 2 }, { item_name: 'Windows', sort_order: 3 }, { item_name: 'Doors', sort_order: 4 }, { item_name: 'Fixtures', sort_order: 5 }, { item_name: 'Heating', sort_order: 6 }] },
      { room_name: 'External', items: [{ item_name: 'Front Garden', sort_order: 0 }, { item_name: 'Rear Garden', sort_order: 1 }, { item_name: 'Bins/Waste', sort_order: 2 }, { item_name: 'Gutters', sort_order: 3 }, { item_name: 'Roof (Visual)', sort_order: 4 }] },
    ],
  },
  {
    name: 'Check-In Inventory',
    inspection_type: 'check_in',
    rooms: [
      { room_name: 'Hallway', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Light Fittings', sort_order: 2 }, { item_name: 'Doors', sort_order: 3 }, { item_name: 'Meter Readings', sort_order: 4 }, { item_name: 'Keys Provided', sort_order: 5 }] },
      { room_name: 'Living Room', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor/Carpet', sort_order: 2 }, { item_name: 'Windows', sort_order: 3 }, { item_name: 'Curtains/Blinds', sort_order: 4 }, { item_name: 'Furniture', sort_order: 5 }, { item_name: 'Light Fittings', sort_order: 6 }] },
      { room_name: 'Kitchen', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Worktops', sort_order: 2 }, { item_name: 'Sink & Taps', sort_order: 3 }, { item_name: 'Oven', sort_order: 4 }, { item_name: 'Hob', sort_order: 5 }, { item_name: 'Fridge/Freezer', sort_order: 6 }, { item_name: 'Dishwasher', sort_order: 7 }, { item_name: 'Washing Machine', sort_order: 8 }, { item_name: 'Cupboards', sort_order: 9 }] },
      { room_name: 'Bathroom', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Bath/Shower', sort_order: 2 }, { item_name: 'Toilet', sort_order: 3 }, { item_name: 'Basin', sort_order: 4 }, { item_name: 'Mirror/Cabinet', sort_order: 5 }, { item_name: 'Towel Rail', sort_order: 6 }] },
      { room_name: 'Bedroom', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor/Carpet', sort_order: 1 }, { item_name: 'Windows', sort_order: 2 }, { item_name: 'Curtains/Blinds', sort_order: 3 }, { item_name: 'Bed Frame', sort_order: 4 }, { item_name: 'Mattress', sort_order: 5 }, { item_name: 'Wardrobe', sort_order: 6 }, { item_name: 'Drawers', sort_order: 7 }] },
    ],
  },
  {
    name: 'Check-Out Inventory',
    inspection_type: 'check_out',
    rooms: [
      { room_name: 'Hallway', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Light Fittings', sort_order: 2 }, { item_name: 'Doors', sort_order: 3 }, { item_name: 'Meter Readings', sort_order: 4 }, { item_name: 'Keys Returned', sort_order: 5 }] },
      { room_name: 'Living Room', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Ceiling', sort_order: 1 }, { item_name: 'Floor/Carpet', sort_order: 2 }, { item_name: 'Windows', sort_order: 3 }, { item_name: 'Curtains/Blinds', sort_order: 4 }, { item_name: 'Furniture', sort_order: 5 }, { item_name: 'Cleaning Standard', sort_order: 6 }] },
      { room_name: 'Kitchen', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Worktops', sort_order: 2 }, { item_name: 'Sink & Taps', sort_order: 3 }, { item_name: 'Oven', sort_order: 4 }, { item_name: 'Hob', sort_order: 5 }, { item_name: 'Fridge/Freezer', sort_order: 6 }, { item_name: 'Cupboards', sort_order: 7 }, { item_name: 'Cleaning Standard', sort_order: 8 }] },
      { room_name: 'Bathroom', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor', sort_order: 1 }, { item_name: 'Bath/Shower', sort_order: 2 }, { item_name: 'Toilet', sort_order: 3 }, { item_name: 'Basin', sort_order: 4 }, { item_name: 'Cleaning Standard', sort_order: 5 }] },
      { room_name: 'Bedroom', items: [{ item_name: 'Walls', sort_order: 0 }, { item_name: 'Floor/Carpet', sort_order: 1 }, { item_name: 'Windows', sort_order: 2 }, { item_name: 'Bed Frame', sort_order: 3 }, { item_name: 'Mattress', sort_order: 4 }, { item_name: 'Wardrobe', sort_order: 5 }, { item_name: 'Cleaning Standard', sort_order: 6 }] },
    ],
  },
  {
    name: 'Mid-Tenancy Review',
    inspection_type: 'mid_tenancy',
    rooms: [
      { room_name: 'General', items: [{ item_name: 'Smoke Alarms', sort_order: 0 }, { item_name: 'CO Alarms', sort_order: 1 }, { item_name: 'Fire Exits', sort_order: 2 }, { item_name: 'Heating System', sort_order: 3 }, { item_name: 'Hot Water', sort_order: 4 }] },
      { room_name: 'Kitchen', items: [{ item_name: 'General Condition', sort_order: 0 }, { item_name: 'Appliances', sort_order: 1 }, { item_name: 'Plumbing', sort_order: 2 }, { item_name: 'Ventilation', sort_order: 3 }] },
      { room_name: 'Bathroom', items: [{ item_name: 'General Condition', sort_order: 0 }, { item_name: 'Plumbing', sort_order: 1 }, { item_name: 'Ventilation', sort_order: 2 }, { item_name: 'Damp/Mould', sort_order: 3 }] },
      { room_name: 'Bedrooms', items: [{ item_name: 'General Condition', sort_order: 0 }, { item_name: 'Windows', sort_order: 1 }, { item_name: 'Damp/Mould', sort_order: 2 }] },
      { room_name: 'External', items: [{ item_name: 'Garden/Yard', sort_order: 0 }, { item_name: 'Gutters', sort_order: 1 }, { item_name: 'Exterior Walls', sort_order: 2 }] },
    ],
  },
];
