import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AuditLogEntry, AuditLogFilters } from '@/lib/auditLogTypes';

const AUDIT_LOG_TABLE = 'audit_log' as never;

export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit_log', filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at, context, session_id, ip_address', { count: 'exact' });

      if (filters.tableName && filters.tableName !== 'all') {
        query = query.eq('table_name', filters.tableName);
      }
      if (filters.action && filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.dateFrom) {
        query = query.gte('changed_at', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('changed_at', filters.dateTo + 'T23:59:59');
      }
      if (filters.search) {
        query = query.or(`old_values.cs.{"${filters.search}"},new_values.cs.{"${filters.search}"}`);
      }

      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;

      query = query.order('changed_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { entries: (data || []) as unknown as AuditLogEntry[], totalCount: count || 0 };
    },
  });
}

export function useRecordAuditHistory(tableName: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['audit_log_record', tableName, recordId],
    queryFn: async () => {
      if (!recordId) return [];
      const { data, error } = await (supabase as any)
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at, old_values, new_values')
        .eq('table_name', tableName)
        .eq('record_id', recordId)
        .order('changed_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as AuditLogEntry[];
    },
    enabled: !!recordId,
  });
}

export function useRelatedAuditHistory(recordId: string | undefined, relatedTables?: string[]) {
  return useQuery({
    queryKey: ['audit_log_related', recordId, relatedTables],
    queryFn: async () => {
      if (!recordId) return [];
      // Get audit entries where the record_id matches OR any value contains the recordId
      const query = (supabase as any)
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at, old_values, new_values')
        .eq('record_id', recordId)
        .order('changed_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as AuditLogEntry[];
    },
    enabled: !!recordId,
  });
}

export function useRecentActivity(limit = 10) {
  return useQuery({
    queryKey: ['audit_log_recent', limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as AuditLogEntry[];
    },
  });
}
