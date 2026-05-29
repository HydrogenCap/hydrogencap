import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/contexts/AuthContext';
import { seedDemoData, clearDemoData } from '@/lib/seedDemoData';
import { toast } from "sonner";

export function useDemoData() {
  const { user } = useAuth();
  const { data: org } = useOrganization();
  const queryClient = useQueryClient();

  const { data: hasDemoData = false, isLoading } = useQuery({
    queryKey: ['demo-data-check', org?.id],
    queryFn: async () => {
      if (!org?.id) return false;
      const { count } = await supabaseAny
        .from('properties_v2')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', org.id)
        .eq('is_demo', true);
      return (count ?? 0) > 0;
    },
    enabled: !!org?.id,
    staleTime: 1000 * 60 * 5,
  });

  const seed = useMutation({
    mutationFn: async () => {
      if (!org?.id || !user?.id) throw new Error('Not authenticated');
      const result = await seedDemoData(org.id, user.id);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Demo portfolio loaded', { description: '3 properties with sample data' });
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error('Failed to load demo data', { description: err.message });
    },
  });

  const clear = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error('Not authenticated');
      const result = await clearDemoData(org.id);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      toast.success('Demo data removed', { description: 'Your portfolio is now empty' });
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast.error('Failed to remove demo data', { description: err.message });
    },
  });

  return {
    hasDemoData,
    isLoading,
    seed,
    clear,
  };
}
