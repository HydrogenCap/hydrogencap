import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { ChatMessage } from './useChatMessages';

export interface ToolCallExecution {
  name: string;
  args: Record<string, unknown>;
}

export interface PendingAction {
  name: string;
  args: Record<string, unknown>;
  description: string;
}

interface SendMessageResult {
  conversation_id: string;
  content: string;
  tool_calls_executed: ToolCallExecution[];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/portfolio-chat`;

// Tool names that display friendly labels during execution
const TOOL_LABELS: Record<string, string> = {
  get_property_details: 'Looking up property details',
  create_compliance_task: 'Creating compliance task',
  calculate_portfolio_metrics: 'Calculating portfolio metrics',
  search_properties: 'Searching properties',
  generate_report: 'Generating report',
  schedule_reminder: 'Scheduling reminder',
};

export function getToolLabel(toolName: string): string {
  return TOOL_LABELS[toolName] ?? `Running ${toolName}`;
}

export function useChat() {
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const sendMessage = useCallback(
    async (
      messageText: string,
      conversationId: string | null
    ): Promise<{ conversationId: string; content: string; toolCalls: ToolCallExecution[] } | null> => {
      if (!messageText.trim() || isLoading) return null;

      setIsLoading(true);
      setActiveTools([]);

      // Add optimistic user message
      const optimisticUser: ChatMessage = {
        id: `opt-user-${Date.now()}`,
        role: 'user',
        content: messageText.trim(),
        tool_calls: null,
        tool_call_id: null,
        created_at: new Date().toISOString(),
      };
      setOptimisticMessages([optimisticUser]);

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Please log in to use chat');

        // Set a generic "thinking" tool indicator
        setActiveTools(['thinking']);

        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: messageText.trim(),
            conversation_id: conversationId ?? undefined,
          }),
        });

        if (!resp.ok) {
          const errorData = await resp.json().catch(() => ({}));
          throw new Error(errorData.error || `Request failed: ${resp.status}`);
        }

        const result: SendMessageResult = await resp.json();

        // Show tool labels for what was executed
        if (result.tool_calls_executed?.length > 0) {
          setActiveTools(result.tool_calls_executed.map((tc) => tc.name));
        }

        // Clear optimistic messages and refresh real data
        setOptimisticMessages([]);
        queryClient.invalidateQueries({ queryKey: ['chat-messages', result.conversation_id] });
        queryClient.invalidateQueries({ queryKey: ['chat-conversations'] });

        return {
          conversationId: result.conversation_id,
          content: result.content,
          toolCalls: result.tool_calls_executed ?? [],
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
        toast({
          title: 'Chat Error',
          description: errorMessage,
          variant: 'destructive',
        });
        setOptimisticMessages([]);
        return null;
      } finally {
        setIsLoading(false);
        setActiveTools([]);
      }
    },
    [isLoading, queryClient, toast]
  );

  return {
    sendMessage,
    isLoading,
    activeTools,
    optimisticMessages,
  };
}
