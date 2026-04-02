import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string | null;
  tool_calls: ToolCall[] | null;
  tool_call_id: string | null;
  created_at: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

const CHAT_BASE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-chat`;

export function useChatMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ['chat-messages', conversationId],
    queryFn: async (): Promise<ChatMessage[]> => {
      if (!conversationId) return [];
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error('Please log in');
      const resp = await fetch(`${CHAT_BASE_URL}/conversations/${conversationId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) throw new Error('Failed to load messages');
      const data = await resp.json();
      return data.messages;
    },
    enabled: !!conversationId,
    staleTime: 10_000,
  });
}
