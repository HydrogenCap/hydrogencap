import { useState } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ShieldCheck, ShieldAlert, ShieldX, Pencil, ExternalLink, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateTenancyAgreement, type TenancyAgreement } from '@/hooks/useTenancyAgreements';
import { toast } from "sonner";

const DEPOSIT_SCHEMES = [
  { value: 'dps', label: 'DPS (Deposit Protection Service)', url: 'https://www.depositprotection.com' },
  { value: 'mydeposits', label: 'mydeposits', url: 'https://www.mydeposits.co.uk' },
  { value: 'tds', label: 'TDS (Tenancy Deposit Scheme)', url: 'https://www.tenancydepositscheme.com' },
  { value: 'none', label: 'No deposit taken' },
];

const fmt = (d: string | null | undefined) =>
  d ? format(parseISO(d), 'dd MMM yyyy') : '—';

const fmtGBP = (n: number | null | undefined) =>
  n != null ? `£${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

interface Props {
  agreement: TenancyAgreement & { room_name?: string; property_address?: string };
}

export function DepositProtectionCard({ agreement }: Props) {
  const updateAgreement = useUpdateTenancyAgreement();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    deposit_scheme: agreement.deposit_scheme ?? '',
    deposit_reference: agreement.deposit_reference ?? '',
    deposit_protected_date: agreement.deposit_protected_date ?? '',
    prescribed_info_served_date: agreement.prescribed_info_served_date ?? '',
    how_to_rent_served_date: agreement.how_to_rent_served_date ?? '',
  });

  const hasDeposit = (agreement.deposit_amount ?? 0) > 0;
  const schemeSet = !!agreement.deposit_scheme && agreement.deposit_scheme !== 'none';
  const isProtected = schemeSet && !!agreement.deposit_protected_date;

  const daysToProtect = agreement.deposit_protected_date && agreement.start_date
    ? differenceInDays(parseISO(agreement.deposit_protected_date), parseISO(agreement.start_date))
    : null;
  const isLate = daysToProtect !== null && daysToProtect > 30;
  const prescribedInfoServed = !!agreement.prescribed_info_served_date;

  const getStatus = () => {
    if (!hasDeposit || agreement.deposit_scheme === 'none') return 'no-deposit';
    if (!schemeSet) return 'unprotected';
    if (!isProtected) return 'unprotected';
    if (isLate) return 'late';
    return 'protected';
  };
  const status = getStatus();

  const statusConfig = {
    'no-deposit': {
      icon: <ShieldCheck className="h-4 w-4 text-muted-foreground" />,
      badge: <Badge variant="secondary">No Deposit</Badge>,
      bg: '',
    },
    protected: {
      icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
      badge: <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Protected</Badge>,
      bg: '',
    },
    late: {
      icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Protected Late ({daysToProtect} days)</Badge>,
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    },
    unprotected: {
      icon: <ShieldX className="h-4 w-4 text-destructive" />,
      badge: <Badge variant="destructive">Unprotected</Badge>,
      bg: 'bg-destructive/5 border-destructive/20',
    },
  };

  const cfg = statusConfig[status];

  const handleSave = async () => {
    try {
      await updateAgreement.mutateAsync({
        id: agreement.id,
        deposit_scheme: (form.deposit_scheme as TenancyAgreement['deposit_scheme']) || null,
        deposit_reference: form.deposit_reference || null,
        deposit_protected_date: form.deposit_protected_date || null,
        prescribed_info_served_date: form.prescribed_info_served_date || null,
        how_to_rent_served_date: form.how_to_rent_served_date || null,
      });
      toast('Deposit details on file');
      setEditing(false);
    } catch {
      toast.error("Deposit details didn't save", { description: 'Give it another go.' });
    }
  };

  const schemeInfo = DEPOSIT_SCHEMES.find(s => s.value === agreement.deposit_scheme);

  return (
    <Card className={cfg.bg}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {cfg.icon}
            Deposit Protection
          </CardTitle>
          <div className="flex items-center gap-2">
            {cfg.badge}
            {!editing && (
              <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditing(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 text-sm">
        {!editing ? (
          <>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              <DataRow label="Deposit Amount" value={fmtGBP(agreement.deposit_amount)} ok={hasDeposit} />
              <DataRow label="Scheme" value={schemeInfo?.label ?? (agreement.deposit_scheme ?? '—')} ok={schemeSet} />
              <DataRow label="Reference" value={agreement.deposit_reference || '—'} ok={!!agreement.deposit_reference} />
              <DataRow label="Date Protected" value={fmt(agreement.deposit_protected_date)} ok={isProtected} />
              <DataRow label="Prescribed Info Served" value={fmt(agreement.prescribed_info_served_date)} ok={prescribedInfoServed} />
              <DataRow label="How to Rent Served" value={fmt(agreement.how_to_rent_served_date)} ok={!!agreement.how_to_rent_served_date} />
            </div>

            {status === 'unprotected' && hasDeposit && (
              <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2 mt-1">
                ⚠️ Deposit must be protected within 30 days of receipt. Failure exposes you to a penalty of 1–3× the deposit amount.
              </div>
            )}
            {status === 'late' && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-xs p-2 mt-1">
                ⚠️ Deposit was protected {daysToProtect} days after tenancy start (limit is 30 days). Document this carefully.
              </div>
            )}

            {schemeInfo && 'url' in schemeInfo && (
              <a
                href={schemeInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {schemeInfo.label} portal <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Deposit Scheme</Label>
                <Select value={form.deposit_scheme} onValueChange={v => setForm(f => ({ ...f, deposit_scheme: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select scheme..." /></SelectTrigger>
                  <SelectContent>
                    {DEPOSIT_SCHEMES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Reference Number</Label>
                <Input
                  value={form.deposit_reference}
                  onChange={e => setForm(f => ({ ...f, deposit_reference: e.target.value }))}
                  placeholder="e.g. DPS1234567"
                />
              </div>
              <div className="space-y-1">
                <Label>Date Protected</Label>
                <Input
                  type="date"
                  value={form.deposit_protected_date}
                  onChange={e => setForm(f => ({ ...f, deposit_protected_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Prescribed Info Served</Label>
                <Input
                  type="date"
                  value={form.prescribed_info_served_date}
                  onChange={e => setForm(f => ({ ...f, prescribed_info_served_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>How to Rent Served</Label>
                <Input
                  type="date"
                  value={form.how_to_rent_served_date}
                  onChange={e => setForm(f => ({ ...f, how_to_rent_served_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={updateAgreement.isPending}>
                <Check className="h-3 w-3 mr-1" />
                {updateAgreement.isPending ? 'Saving...' : 'Save'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                <X className="h-3 w-3 mr-1" />Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DataRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={`font-medium ${ok ? '' : 'text-muted-foreground'}`}>{value}</span>
    </div>
  );
}
