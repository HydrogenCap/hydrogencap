import { useQuery } from '@tanstack/react-query';
import { supabaseAny } from '@/integrations/supabase/client';
import type { AuditLogEntry, AuditLogFilters } from '@/lib/auditLogTypes';

const AUDIT_LOG_TABLE = 'audit_log' as never;

function applyFilters(query: any, filters: AuditLogFilters) {
  if (filters.tableName && filters.tableName !== 'all') {
    query = query.eq('table_name', filters.tableName);
  }
  if (filters.action && filters.action !== 'all') {
    query = query.eq('action', filters.action);
  }
  if (filters.userId && filters.userId !== 'all') {
    if (filters.userId === '__system__') {
      query = query.is('changed_by', null);
    } else {
      query = query.eq('changed_by', filters.userId);
    }
  }
  if (filters.recordId) {
    query = query.eq('record_id', filters.recordId);
  }
  if (filters.dateFrom) {
    query = query.gte('changed_at', filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte('changed_at', filters.dateTo + 'T23:59:59');
  }
  if (filters.search) {
    // Escape characters that have special meaning in PostgREST's .or() DSL to
    // prevent filter injection via user-supplied search terms.
    const escaped = String(filters.search)
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/[(),]/g, (ch) => `\\${ch}`);
    query = query.or(`old_values.cs.{"${escaped}"},new_values.cs.{"${escaped}"}`);
  }
  return query;
}

export function useAuditLog(filters: AuditLogFilters) {
  return useQuery({
    queryKey: ['audit_log', filters],
    queryFn: async () => {
      let query = supabaseAny
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at, context, session_id, ip_address', { count: 'exact' });
      query = applyFilters(query, filters);
      const from = (filters.page - 1) * filters.pageSize;
      const to = from + filters.pageSize - 1;
      query = query.order('changed_at', { ascending: false }).range(from, to);
      const { data, error, count } = await query;
      if (error) throw error;
      return { entries: (data || []) as unknown as AuditLogEntry[], totalCount: count || 0 };
    },
  });
}

/**
 * Fetch up to `limit` rows matching the current filters, ignoring pagination.
 * Used by Export CSV so the user gets the full filtered set, not one page.
 */
export async function fetchAuditLogForExport(filters: AuditLogFilters, limit = 5000): Promise<AuditLogEntry[]> {
  let query = supabaseAny
    .from(AUDIT_LOG_TABLE)
    .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at, context, session_id, ip_address, old_values, new_values');
  query = applyFilters(query, filters);
  query = query.order('changed_at', { ascending: false }).limit(limit);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as AuditLogEntry[];
}

export function useRecordAuditHistory(tableName: string, recordId: string | undefined) {
  return useQuery({
    queryKey: ['audit_log_record', tableName, recordId],
    queryFn: async () => {
      if (!recordId) return [];
      const { data, error } = await supabaseAny
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
      const query = supabaseAny
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
      const { data, error } = await supabaseAny
        .from(AUDIT_LOG_TABLE)
        .select('id, table_name, record_id, action, changed_fields, changed_by, changed_at')
        .order('changed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as AuditLogEntry[];
    },
  });
}
