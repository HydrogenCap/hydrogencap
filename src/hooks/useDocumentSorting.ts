import { useMemo } from 'react';
import type { ManagedDocument } from '@/hooks/useDocumentManagement';

type SortBy = 'date' | 'property' | 'name';

/**
 * Sorts documents, splits into current vs archived, and optionally groups by property.
 */
export function useDocumentSorting(
  documents: ManagedDocument[] | undefined,
  sortBy: SortBy,
) {
  // Sort documents
  const sortedDocuments = useMemo(() => {
    if (!documents) return [];
    const docs = [...documents];
    switch (sortBy) {
      case 'property':
        return docs.sort((a, b) => {
          const propA = a.property?.address_line_1 || 'zzz';
          const propB = b.property?.address_line_1 || 'zzz';
          return propA.localeCompare(propB);
        });
      case 'name':
        return docs.sort((a, b) => {
          const nameA = a.display_name || a.original_file_name;
          const nameB = b.display_name || b.original_file_name;
          return nameA.localeCompare(nameB);
        });
      case 'date':
      default:
        return docs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
  }, [documents, sortBy]);

  // Split into current and archived documents
  // A document is archived if: (a) it's expired, OR (b) a newer document of the
  // same category+property exists (only one "live" file per type per property).
  const { currentDocuments, archivedDocuments } = useMemo(() => {
    const now = new Date();
    const current: typeof sortedDocuments = [];
    const archived: typeof sortedDocuments = [];

    const newestByKey = new Map<string, { date: number; id: string }>();
    for (const doc of sortedDocuments) {
      if (!doc.property_id || !doc.category) continue;
      const key = `${doc.property_id}::${doc.category}`;
      const docDate = doc.document_date
        ? new Date(doc.document_date).getTime()
        : new Date(doc.created_at).getTime();
      const existing = newestByKey.get(key);
      if (!existing || docDate > existing.date) {
        newestByKey.set(key, { date: docDate, id: doc.id });
      }
    }

    for (const doc of sortedDocuments) {
      if (doc.expiry_date && new Date(doc.expiry_date) < now) {
        archived.push(doc);
        continue;
      }
      if (doc.property_id && doc.category) {
        const key = `${doc.property_id}::${doc.category}`;
        const newest = newestByKey.get(key);
        if (newest && newest.id !== doc.id) {
          archived.push(doc);
          continue;
        }
      }
      current.push(doc);
    }
    return { currentDocuments: current, archivedDocuments: archived };
  }, [sortedDocuments]);

  // Group by property when sorting by property
  const groupedByProperty = useMemo(() => {
    if (sortBy !== 'property' || !currentDocuments.length) return null;
    const groups = new Map<string, typeof currentDocuments>();
    for (const doc of currentDocuments) {
      const key = doc.property?.address_line_1 || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(doc);
    }
    return groups;
  }, [sortBy, currentDocuments]);

  return { sortedDocuments, currentDocuments, archivedDocuments, groupedByProperty };
}
