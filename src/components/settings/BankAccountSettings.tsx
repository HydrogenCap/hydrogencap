import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Building2, Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { useBankAccounts, useCreateBankAccount, useUpdateBankAccount, useDeleteBankAccount, type BankAccount } from '@/hooks/useBankAccounts';
import { useLegalEntities } from '@/hooks/useLegalEntities';

const ACCOUNT_TYPES = [
  { value: 'current', label: 'Current' },
  { value: 'savings', label: 'Savings' },
  { value: 'rent_collection', label: 'Rent Collection' },
  { value: 'reserve', label: 'Reserve' },
];

function maskSortCode(sc: string | null): string {
  if (!sc) return '—';
  const digits = sc.replace(/\D/g, '');
  if (digits.length < 6) return sc;
  return `XX-XX-${digits.slice(4, 6)}`;
}

function maskAccountNumber(an: string | null): string {
  if (!an) return '—';
  const digits = an.replace(/\D/g, '');
  if (digits.length < 4) return an;
  return `XXXXXX${digits.slice(-2)}`;
}

export function BankAccountSettings() {
  const { data: accounts, isLoading } = useBankAccounts();
  const { data: entities } = useLegalEntities();
  const createAccount = useCreateBankAccount();
  const updateAccount = useUpdateBankAccount();
  const deleteAccount = useDeleteBankAccount();

  const [editingAccount, setEditingAccount] = useState<Partial<BankAccount> | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openNew = () => {
    setEditingAccount({
      account_name: '',
      bank_name: '',
      sort_code: '',
      account_number: '',
      account_type: 'current',
      entity_id: '',
      is_primary: false,
      is_active: true,
      notes: '',
    });
    setIsDialogOpen(true);
  };

  const openEdit = (account: BankAccount) => {
    setEditingAccount({ ...account });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingAccount) return;
    if (!editingAccount.account_name || !editingAccount.bank_name || !editingAccount.entity_id) return;

    if (editingAccount.id) {
      updateAccount.mutate(editingAccount as BankAccount & { id: string }, {
        onSuccess: () => setIsDialogOpen(false),
      });
    } else {
      createAccount.mutate(editingAccount as Omit<BankAccount, 'id' | 'org_id' | 'created_at' | 'updated_at'>, {
        onSuccess: () => setIsDialogOpen(false),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Bank Accounts
            </CardTitle>
            <CardDescription>Manage bank accounts used for rent collection</CardDescription>
          </div>
          <Button onClick={openNew} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Add Bank Account
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : !accounts?.length ? (
          <p className="text-muted-foreground text-sm text-center py-8">No bank accounts configured. Add one to start importing bank statements.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Bank</TableHead>
                <TableHead>Sort Code</TableHead>
                <TableHead>Account No.</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map(account => {
                const revealed = revealedIds.has(account.id);
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.account_name}
                      {account.is_primary && <Badge variant="secondary" className="ml-2 text-xs">Primary</Badge>}
                    </TableCell>
                    <TableCell>{account.bank_name}</TableCell>
                    <TableCell className="tabular-nums">
                      {revealed ? (account.sort_code || '—') : maskSortCode(account.sort_code)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {revealed ? (account.account_number || '—') : maskAccountNumber(account.account_number)}
                    </TableCell>
                    <TableCell>{account.entity?.entity_name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {account.account_type.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button aria-label="Hide" variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleReveal(account.id)}>
                          {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </Button>
                        <Button aria-label="Edit" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button aria-label="Delete"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteAccount.mutate(account.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingAccount?.id ? 'Edit Bank Account' : 'Add Bank Account'}</DialogTitle>
              <DialogDescription>
                {editingAccount?.id ? 'Update bank account details' : 'Add a new bank account for rent collection'}
              </DialogDescription>
            </DialogHeader>

            {editingAccount && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account Name *</Label>
                  <Input
                    value={editingAccount.account_name || ''}
                    onChange={e => setEditingAccount(prev => prev ? { ...prev, account_name: e.target.value } : null)}
                    placeholder="e.g. Main Rent Account"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Bank Name *</Label>
                  <Input
                    value={editingAccount.bank_name || ''}
                    onChange={e => setEditingAccount(prev => prev ? { ...prev, bank_name: e.target.value } : null)}
                    placeholder="e.g. Barclays"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Sort Code</Label>
                    <Input
                      value={editingAccount.sort_code || ''}
                      onChange={e => setEditingAccount(prev => prev ? { ...prev, sort_code: e.target.value } : null)}
                      placeholder="XX-XX-XX"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Account Number</Label>
                    <Input
                      value={editingAccount.account_number || ''}
                      onChange={e => setEditingAccount(prev => prev ? { ...prev, account_number: e.target.value } : null)}
                      placeholder="XXXXXXXX"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Linked Entity *</Label>
                  <Select
                    value={editingAccount.entity_id || ''}
                    onValueChange={v => setEditingAccount(prev => prev ? { ...prev, entity_id: v } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select entity" />
                    </SelectTrigger>
                    <SelectContent>
                      {entities?.map(e => (
                        <SelectItem key={e.id} value={e.id}>{e.entity_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Account Type</Label>
                  <Select
                    value={editingAccount.account_type || 'current'}
                    onValueChange={v => setEditingAccount(prev => prev ? { ...prev, account_type: v } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={editingAccount.is_primary || false}
                    onCheckedChange={v => setEditingAccount(prev => prev ? { ...prev, is_primary: v } : null)}
                  />
                  <Label>Primary account</Label>
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={editingAccount.notes || ''}
                    onChange={e => setEditingAccount(prev => prev ? { ...prev, notes: e.target.value } : null)}
                    rows={2}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={handleSave}
                disabled={createAccount.isPending || updateAccount.isPending}
              >
                {editingAccount?.id ? 'Save Changes' : 'Add Account'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
