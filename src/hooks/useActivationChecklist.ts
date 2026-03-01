import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/hooks/useOrganization';

interface ChecklistData {
  propertiesCount: number;
  roomsCount: number;
  complianceCount: number;
  tenantsCount: number;
  loansCount: number;
  membersCount: number;
  dismissed: boolean;
}

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  completed: boolean;
  route: string;
  optional?: boolean;
}

export function useActivationChecklist() {
  const { user } = useAuth();
  const { data: org } = useOrganization();

  const { data, isLoading } = useQuery<ChecklistData | null>({
    queryKey: ['activation-checklist', org?.id],
    queryFn: async (): Promise<ChecklistData | null> => {
      if (!org?.id) return null;

      const sq = supabase as any;
      const propertiesRes = await sq.from('properties_v2').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const roomsRes = await sq.from('rooms_v2').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const complianceRes = await sq.from('compliance_documents_v2').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const tenantsRes = await sq.from('tenants_v2').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const loansRes = await sq.from('loan_facilities').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const membersRes = await sq.from('memberships').select('id', { count: 'exact', head: true }).eq('org_id', org.id);
      const profileRes = await supabase.from('profiles').select('checklist_dismissed').eq('user_id', user!.id).single();

      return {
        propertiesCount: propertiesRes.count ?? 0,
        roomsCount: roomsRes.count ?? 0,
        complianceCount: complianceRes.count ?? 0,
        tenantsCount: tenantsRes.count ?? 0,
        loansCount: loansRes.count ?? 0,
        membersCount: membersRes.count ?? 0,
        dismissed: (profileRes.data as any)?.checklist_dismissed ?? false,
      };
    },
    enabled: !!org?.id && !!user,
    staleTime: 1000 * 60 * 5,
  });

  const items: ChecklistItem[] = [
    {
      id: 'add_property',
      label: 'Add your first property',
      description: 'Set up a property with address and type',
      completed: (data?.propertiesCount ?? 0) > 0,
      route: '/properties-v2',
    },
    {
      id: 'add_rooms',
      label: 'Add rooms to a property',
      description: 'Define lettable rooms with rent amounts',
      completed: (data?.roomsCount ?? 0) > 0,
      route: '/properties-v2',
    },
    {
      id: 'upload_compliance',
      label: 'Upload a compliance certificate',
      description: 'Gas safety, EPC, EICR — keep them all in one place',
      completed: (data?.complianceCount ?? 0) > 0,
      route: '/compliance-v2',
    },
    {
      id: 'add_tenant',
      label: 'Add a tenant',
      description: 'Record your tenants and tenancy details',
      completed: (data?.tenantsCount ?? 0) > 0,
      route: '/tenants-v2',
    },
    {
      id: 'add_mortgage',
      label: 'Add mortgage details',
      description: 'Track LTV, rates, and monthly payments',
      completed: (data?.loansCount ?? 0) > 0,
      route: '/lending',
    },
    {
      id: 'invite_team',
      label: 'Invite a team member',
      description: 'Collaborate with your business partner or accountant',
      completed: (data?.membersCount ?? 0) > 1,
      route: '/settings?tab=team',
      optional: true,
    },
  ];

  const requiredItems = items.filter(i => !i.optional);
  const completedCount = items.filter(i => i.completed).length;
  const totalRequired = requiredItems.length;
  const allRequiredComplete = requiredItems.every(i => i.completed);

  const dismiss = async () => {
    if (!user) return;
    await supabase
      .from('profiles')
      .update({ checklist_dismissed: true } as any)
      .eq('user_id', user.id);
  };

  return {
    items,
    completedCount,
    totalRequired,
    totalItems: items.length,
    allRequiredComplete,
    dismissed: data?.dismissed ?? false,
    isLoading,
    dismiss,
  };
}
