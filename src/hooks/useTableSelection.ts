import { useCallback, useMemo, useState } from 'react';

/**
 * Generic multi-select state for tables/lists.
 *
 * Usage:
 *   const sel = useTableSelection(items.map(i => i.id));
 *   <Checkbox checked={sel.isAllSelected} onCheckedChange={sel.toggleAll} />
 *   <Checkbox checked={sel.isSelected(id)} onCheckedChange={() => sel.toggle(id)} />
 *   {sel.count > 0 && <BulkActionBar selectedIds={sel.selectedIds} onClear={sel.clear} />}
 */
export function useTableSelection(allIds: string[]) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => (prev.size === allIds.length ? new Set() : new Set(allIds)));
  }, [allIds]);

  const isSelected = useCallback((id: string) => selected.has(id), [selected]);

  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  return {
    selected,
    selectedIds,
    count: selected.size,
    isSelected,
    isAllSelected: allIds.length > 0 && selected.size === allIds.length,
    isPartiallySelected: selected.size > 0 && selected.size < allIds.length,
    toggle,
    toggleAll,
    clear,
    setSelected,
  };
}
