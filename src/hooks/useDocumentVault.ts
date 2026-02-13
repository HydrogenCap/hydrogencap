import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentCategories, type ManagedDocument } from '@/hooks/useDocumentManagement';

// ─── Types ───────────────────────────────────────────────────────

export interface CategorySummary {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  count: number;
  recentCount: number;
  expiringCount: number;
}

export interface VaultFilters {
  category?: string;
  propertyId?: string;
  companyId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  hasExpiry?: boolean;
}

// ─── Category summary hook ───────────────────────────────────────

export function useDocumentCategorySummaries() {
  const { data: categories } = useDocumentCategories();

  return useQuery({
    queryKey: ['document-vault-summaries'],
    queryFn: async () => {
      const { data: documents, error } = await supabase
        .from('documents')
        .select('id, category, created_at, expiry_date')
        .is('deleted_at', null);

      if (error) throw error;

      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const statsMap = new Map<string, { count: number; recent: number; expiring: number }>();

      for (const doc of documents || []) {
        const cat = doc.category || 'other';
        const existing = statsMap.get(cat) || { count: 0, recent: 0, expiring: 0 };
        existing.count++;
        if (new Date(doc.created_at) > thirtyDaysAgo) existing.recent++;
        if (doc.expiry_date) {
          const exp = new Date(doc.expiry_date);
          if (exp > now && exp < thirtyDaysFromNow) existing.expiring++;
        }
        statsMap.set(cat, existing);
      }

      const summaries: CategorySummary[] = (categories || []).map(cat => {
        const stats = statsMap.get(cat.slug) || { count: 0, recent: 0, expiring: 0 };
        return {
          slug: cat.slug,
          name: cat.name,
          description: cat.description,
          icon: cat.icon,
          color: cat.color,
          count: stats.count,
          recentCount: stats.recent,
          expiringCount: stats.expiring,
        };
      });

      const totalCount = (documents || []).length;

      return { summaries, totalCount };
    },
    enabled: !!categories,
    staleTime: 60_000,
  });
}

// ─── Vault documents hook (extended filters) ─────────────────────

export function useVaultDocuments(filters: VaultFilters) {
  return useQuery({
    queryKey: ['document-vault', filters],
    queryFn: async () => {
      let query = supabase
        .from('documents')
        .select(`
          *,
          property:properties!documents_property_id_fkey(id, address_line, postcode),
          company:companies(id, legal_name)
        `)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (filters.category && filters.category !== 'all') {
        query = query.eq('category', filters.category);
      }
      if (filters.propertyId) {
        query = query.eq('property_id', filters.propertyId);
      }
      if (filters.companyId) {
        query = query.eq('company_id', filters.companyId);
      }
      if (filters.dateFrom) {
        query = query.gte('document_date', filters.dateFrom);
      }
      if (filters.dateTo) {
        query = query.lte('document_date', filters.dateTo);
      }
      if (filters.hasExpiry) {
        query = query.not('expiry_date', 'is', null);
      }

      const { data, error } = await query;
      if (error) throw error;

      let results = data as (ManagedDocument & {
        property?: { id: string; address_line: string; postcode: string | null } | null;
        company?: { id: string; legal_name: string } | null;
      })[];

      if (filters.search) {
        const s = filters.search.toLowerCase();
        results = results.filter(doc =>
          doc.display_name?.toLowerCase().includes(s) ||
          doc.original_file_name.toLowerCase().includes(s) ||
          doc.description?.toLowerCase().includes(s) ||
          doc.property?.address_line?.toLowerCase().includes(s) ||
          doc.company?.legal_name?.toLowerCase().includes(s)
        );
      }

      return results;
    },
  });
}
