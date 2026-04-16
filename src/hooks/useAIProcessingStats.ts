import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserOrg } from './useUserOrg';

export interface AIProcessingStats {
  processedToday: number;
  awaitingReview: number;
  autoFileRate: number;
  totalProcessed30d: number;
  autoFiled30d: number;
  avgProcessingTime: number;
  totalTokens30d: number;
  classificationAccuracy: number;
}

export function useAIProcessingStats() {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['ai-processing-stats', orgId],
    queryFn: async (): Promise<AIProcessingStats> => {
      if (!orgId) throw new Error('No org');

      // Local midnight as a UTC timestamp so "today" tracks the user's calendar day,
      // not UTC's. (Avoids off-by-one when user's local time is in a different UTC date.)
      const localMidnight = new Date();
      localMidnight.setHours(0, 0, 0, 0);
      const todayStart = localMidnight.toISOString();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      // Processed today
      const { count: processedToday } = await (supabase as any)
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('extraction_status', 'completed')
        .gte('created_at', todayStart);

      // Awaiting review
      const { count: awaitingReview } = await (supabase as any)
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('extraction_status', 'completed')
        .eq('review_status', 'pending');

      // 30-day stats
      const { data: docs30d } = await (supabase as any)
        .from('documents')
        .select('auto_filed, processing_time_ms, ai_tokens_used, review_status, ai_suggested_doc_type, doc_type')
        .eq('org_id', orgId)
        .eq('extraction_status', 'completed')
        .gte('created_at', thirtyDaysAgo);

      const all30d = docs30d || [];
      const totalProcessed30d = all30d.length;
      const autoFiled30d = all30d.filter(d => d.auto_filed).length;
      const autoFileRate = totalProcessed30d > 0 ? (autoFiled30d / totalProcessed30d) * 100 : 0;

      const processingTimes = all30d.filter(d => d.processing_time_ms).map(d => d.processing_time_ms!);
      const avgProcessingTime = processingTimes.length > 0
        ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0;

      const totalTokens30d = all30d.reduce((sum, d) => sum + (d.ai_tokens_used || 0), 0);

      // Classification accuracy: accepted docs where AI suggestion was not corrected
      const accepted = all30d.filter(d => d.review_status === 'accepted');
      const notCorrected = accepted.filter(d => d.ai_suggested_doc_type === d.doc_type || d.auto_filed);
      const classificationAccuracy = accepted.length > 0
        ? (notCorrected.length / accepted.length) * 100 : 100;

      return {
        processedToday: processedToday || 0,
        awaitingReview: awaitingReview || 0,
        autoFileRate,
        totalProcessed30d,
        autoFiled30d,
        avgProcessingTime,
        totalTokens30d,
        classificationAccuracy,
      };
    },
    enabled: !!orgId,
  });
}

export function useProcessingHistory(limit = 50) {
  const { data: orgId } = useUserOrg();

  return useQuery({
    queryKey: ['ai-processing-history', orgId, limit],
    queryFn: async () => {
      if (!orgId) throw new Error('No org');

      const { data, error } = await (supabase as any)
        .from('documents')
        .select(`
          id, original_file_name, ai_suggested_doc_type, ai_doc_type_confidence,
          ai_suggested_property_id, ai_property_confidence, extraction_status,
          review_status, auto_filed, auto_file_confidence, processing_time_ms,
          ai_tokens_used, created_at, expiry_date, extracted_issue_date,
          extracted_address_text, validation_errors, validation_warnings
        `)
        .eq('org_id', orgId)
        .not('extraction_status', 'is', null)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    },
    enabled: !!orgId,
  });
}
