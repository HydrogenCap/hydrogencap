import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAccountingMappings, useUpdateMapping } from '@/hooks/useAccountingMappings';
import { CATEGORY_LABELS, type AccountingSystem, type HydrogencapCategory } from '@/lib/accountingTypes';

const SYSTEMS: { value: AccountingSystem; label: string }[] = [
  { value: 'xero', label: 'Xero' },
  { value: 'quickbooks', label: 'QuickBooks' },
  { value: 'freeagent', label: 'FreeAgent' },
  { value: 'sage', label: 'Sage' },
  { value: 'generic', label: 'Generic' },
];

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS) as HydrogencapCategory[];

export function MappingsSection() {
  const [system, setSystem] = useState<AccountingSystem>('xero');
  const { data: mappings, isLoading } = useAccountingMappings(system);
  const updateMapping = useUpdateMapping();
  const [edits, setEdits] = useState<Record<string, Partial<{ account_code: string; account_name: string; tax_rate_code: string }>>>({});

  const mappingsByCategory = useMemo(() => {
    const map = new Map<string, typeof mappings extends (infer T)[] | undefined ? T : never>();
    for (const m of mappings || []) {
      map.set(m.hydrogencap_category, m);
    }
    return map;
  }, [mappings]);

  const handleEdit = (id: string, field: string, value: string) => {
    setEdits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const handleSave = async (id: string) => {
    const changes = edits[id];
    if (!changes) return;
    try {
      await updateMapping.mutateAsync({ id, ...changes });
      setEdits(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      toast.success('Mapping updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={system} onValueChange={v => { setSystem(v as AccountingSystem); setEdits({}); }}>
        <TabsList>
          {SYSTEMS.map(s => (
            <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
          ))}
        </TabsList>

        {SYSTEMS.map(s => (
          <TabsContent key={s.value} value={s.value}>
            <Card>
              <CardHeader>
                <CardTitle>{s.label} Account Mappings</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <p className="text-muted-foreground">Loading...</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>HydrogenCap Category</TableHead>
                        <TableHead>Account Code</TableHead>
                        <TableHead>Account Name</TableHead>
                        <TableHead>Tax Rate</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ALL_CATEGORIES.map(cat => {
                        const mapping = mappingsByCategory.get(cat);
                        if (!mapping) return (
                          <TableRow key={cat}>
                            <TableCell className="font-medium">{CATEGORY_LABELS[cat]}</TableCell>
                            <TableCell colSpan={4} className="text-muted-foreground text-sm">No mapping configured</TableCell>
                          </TableRow>
                        );
                        const edit = edits[mapping.id] || {};
                        const hasChanges = Object.keys(edit).length > 0;
                        return (
                          <TableRow key={cat}>
                            <TableCell className="font-medium text-sm">{CATEGORY_LABELS[cat]}</TableCell>
                            <TableCell>
                              <Input
                                className="h-8 text-sm w-24"
                                value={edit.account_code ?? mapping.account_code}
                                onChange={e => handleEdit(mapping.id, 'account_code', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 text-sm"
                                value={edit.account_name ?? mapping.account_name}
                                onChange={e => handleEdit(mapping.id, 'account_name', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                className="h-8 text-sm w-24"
                                value={edit.tax_rate_code ?? mapping.tax_rate_code ?? ''}
                                onChange={e => handleEdit(mapping.id, 'tax_rate_code', e.target.value)}
                              />
                            </TableCell>
                            <TableCell>
                              {hasChanges && (
                                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => handleSave(mapping.id)} disabled={updateMapping.isPending}>
                                  Save
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
