import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const CHAT_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-chat`;

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Please log in to use chat');
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export function useConversations() {
  return useQuery({
    queryKey: ['chat-conversations'],
    queryFn: async (): Promise<Conversation[]> => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${CHAT_BASE_URL}/conversations`, { headers });
      if (!resp.ok) throw new Error('Failed to load conversations');
      const data = await resp.json();
      return data.conversations;
    },
    staleTime: 30_000,
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${CHAT_BASE_URL}/conversations/${conversationId}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok) throw new Error('Failed to delete conversation');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${CHAT_BASE_URL}/conversations/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ title }),
      });
      if (!resp.ok) throw new Error('Failed to update conversation');
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });
    },
  });
}
