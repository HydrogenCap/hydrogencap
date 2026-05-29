import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO, addMonths } from 'date-fns';
import { ShieldCheck, ShieldAlert, ShieldX, Pencil, ExternalLink, Check, X, Clock } from 'lucide-react';
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
import {
  useTenancyCompliance,
  useCompleteTenancyComplianceItem,
  useUncompleteTenancyComplianceItem,
} from '@/hooks/useTenancyCompliance';
import { toast } from "sonner";

const DOCUMENT_TYPES = [
  { value: 'uk_passport', label: 'UK/Irish Passport', hasExpiry: false },
  { value: 'eu_settled', label: 'EU Settled Status (digital)', hasExpiry: false },
  { value: 'eu_pre_settled', label: 'EU Pre-Settled Status (digital)', hasExpiry: true },
  { value: 'brp', label: 'Biometric Residence Permit (BRP)', hasExpiry: true },
  { value: 'evisa', label: 'eVisa / Online Share Code', hasExpiry: true },
  { value: 'visa_stamp', label: 'Vignette / Visa Stamp', hasExpiry: true },
  { value: 'british_passport', label: 'British National (Overseas) Passport', hasExpiry: false },
  { value: 'indefinite_leave', label: 'Indefinite Leave to Remain (ILR)', hasExpiry: false },
  { value: 'other', label: 'Other acceptable document', hasExpiry: false },
];

const HOME_OFFICE_CHECK_URL = 'https://www.gov.uk/view-right-to-rent';

interface ParsedRtrNotes {
  doc_type?: string;
  check_date?: string;
  expiry_date?: string;
  share_code?: string;
}

function parseNotes(notes: string | null): ParsedRtrNotes {
  if (!notes) return {};
  try {
    const parsed = JSON.parse(notes);
    if (typeof parsed === 'object' && parsed !== null) return parsed as ParsedRtrNotes;
  } catch (error) {
    console.error('Failed to parse Right to Rent notes:', error);
  }
  return {};
}

function fmt(d: string | null | undefined) {
  return d ? format(parseISO(d), 'dd MMM yyyy') : '—';
}

interface Props {
  tenancyId: string;
}

export function RightToRentCard({ tenancyId }: Props) {
  const { data: items, isLoading } = useTenancyCompliance(tenancyId);
  const completeMutation = useCompleteTenancyComplianceItem();
  const uncompleteMutation = useUncompleteTenancyComplianceItem();
  const [editing, setEditing] = useState(false);

  const rtrItem = useMemo(() => items?.find(i => i.item_type === 'right_to_rent'), [items]);
  const parsed = useMemo(() => parseNotes(rtrItem?.notes ?? null), [rtrItem]);

  const [form, setForm] = useState<ParsedRtrNotes>({
    doc_type: parsed.doc_type ?? '',
    check_date: parsed.check_date ?? '',
    expiry_date: parsed.expiry_date ?? '',
    share_code: parsed.share_code ?? '',
  });

  if (isLoading || !rtrItem) return null;

  const isChecked = !!rtrItem.completed_date;
  const docTypeInfo = DOCUMENT_TYPES.find(d => d.value === parsed.doc_type);
  const hasExpiry = docTypeInfo?.hasExpiry ?? false;

  const daysUntilExpiry = parsed.expiry_date
    ? differenceInDays(parseISO(parsed.expiry_date), new Date())
    : null;

  const followUpDate = parsed.expiry_date ? addMonths(parseISO(parsed.expiry_date), -2) : null;

  const getStatus = () => {
    if (!isChecked) return 'unchecked';
    if (!parsed.doc_type) return 'incomplete';
    if (hasExpiry && daysUntilExpiry !== null) {
      if (daysUntilExpiry < 0) return 'expired';
      if (daysUntilExpiry < 90) return 'expiring-soon';
    }
    return 'valid';
  };
  const status = getStatus();

  const statusConfig = {
    unchecked: {
      icon: <ShieldX className="h-4 w-4 text-destructive" />,
      badge: <Badge variant="destructive">Check Required</Badge>,
      bg: 'bg-destructive/5 border-destructive/20',
    },
    incomplete: {
      icon: <ShieldAlert className="h-4 w-4 text-amber-600" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Details Missing</Badge>,
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    },
    valid: {
      icon: <ShieldCheck className="h-4 w-4 text-emerald-600" />,
      badge: <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Valid</Badge>,
      bg: '',
    },
    'expiring-soon': {
      icon: <Clock className="h-4 w-4 text-amber-600" />,
      badge: <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Expires in {daysUntilExpiry} days</Badge>,
      bg: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800',
    },
    expired: {
      icon: <ShieldX className="h-4 w-4 text-destructive" />,
      badge: <Badge variant="destructive">Expired</Badge>,
      bg: 'bg-destructive/5 border-destructive/20',
    },
  };

  const cfg = statusConfig[status];

  const handleSave = async () => {
    const notes = JSON.stringify({
      doc_type: form.doc_type || undefined,
      check_date: form.check_date || undefined,
      expiry_date: form.expiry_date || undefined,
      share_code: form.share_code || undefined,
    });
    try {
      if (!isChecked && form.check_date) {
        await completeMutation.mutateAsync({ itemId: rtrItem.id, notes });
      } else {
        // Update notes only — mark as re-checked
        await completeMutation.mutateAsync({ itemId: rtrItem.id, notes });
      }
      toast('Right to Rent on file');
      setEditing(false);
    } catch {
      toast.error("Right to Rent didn't save", { description: 'Give it another go.' });
    }
  };

  const handleClearCheck = async () => {
    try {
      await uncompleteMutation.mutateAsync(rtrItem.id);
      toast.success('Right to Rent record cleared');
    } catch {
      toast.error("Didn't clear", { description: 'Give it another go.' });
    }
  };

  return (
    <Card className={cfg.bg}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            {cfg.icon}
            Right to Rent
          </CardTitle>
          <div className="flex items-center gap-2">
            {cfg.badge}
            {!editing && (
              <Button aria-label="Edit" variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                setForm({
                  doc_type: parsed.doc_type ?? '',
                  check_date: parsed.check_date ?? '',
                  expiry_date: parsed.expiry_date ?? '',
                  share_code: parsed.share_code ?? '',
                });
                setEditing(true);
              }}>
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
              <DataRow label="Document Type" value={docTypeInfo?.label ?? (parsed.doc_type ? parsed.doc_type : '—')} ok={!!parsed.doc_type} />
              <DataRow label="Check Date" value={fmt(parsed.check_date)} ok={!!parsed.check_date} />
              {hasExpiry && (
                <>
                  <DataRow label="Document Expiry" value={fmt(parsed.expiry_date)} ok={!!parsed.expiry_date && (daysUntilExpiry ?? 1) >= 0} />
                  {followUpDate && (
                    <DataRow label="Follow-up Check Due" value={format(followUpDate, 'dd MMM yyyy')} ok={(daysUntilExpiry ?? 1) >= 0} />
                  )}
                </>
              )}
              {parsed.share_code && (
                <DataRow label="Share Code" value={parsed.share_code} ok={true} />
              )}
            </div>

            {status === 'unchecked' && (
              <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2">
                ⚠️ Right to Rent must be checked before or on the tenancy start date. Penalty up to £20,000 per illegal occupier.
              </div>
            )}
            {status === 'expiring-soon' && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-xs p-2">
                ⚠️ Document expires {fmt(parsed.expiry_date)}. A follow-up check is due by {followUpDate ? format(followUpDate, 'dd MMM yyyy') : '—'}. Check the tenant's updated share code or new document.
              </div>
            )}
            {status === 'expired' && (
              <div className="rounded-md bg-destructive/10 text-destructive text-xs p-2">
                ⚠️ The tenant's right to rent document has expired. Perform an immediate follow-up check and report if right to rent has ended.
              </div>
            )}

            <div className="flex items-center gap-3 pt-1">
              <a
                href={HOME_OFFICE_CHECK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Home Office online check <ExternalLink className="h-3 w-3" />
              </a>
              {isChecked && (
                <button
                  onClick={handleClearCheck}
                  className="text-xs text-muted-foreground hover:text-destructive underline"
                >
                  Clear check record
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1 sm:col-span-2">
                <Label>Document Type</Label>
                <Select
                  value={form.doc_type}
                  onValueChange={v => setForm(f => ({ ...f, doc_type: v, expiry_date: DOCUMENT_TYPES.find(d => d.value === v)?.hasExpiry ? f.expiry_date : '' }))}
                >
                  <SelectTrigger><SelectValue placeholder="Select document type..." /></SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map(d => (
                      <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date of Check</Label>
                <Input
                  type="date"
                  value={form.check_date}
                  onChange={e => setForm(f => ({ ...f, check_date: e.target.value }))}
                />
              </div>
              {DOCUMENT_TYPES.find(d => d.value === form.doc_type)?.hasExpiry && (
                <div className="space-y-1">
                  <Label>Document Expiry Date</Label>
                  <Input
                    type="date"
                    value={form.expiry_date}
                    onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                  />
                </div>
              )}
              {(form.doc_type === 'evisa' || form.doc_type === 'eu_settled' || form.doc_type === 'eu_pre_settled') && (
                <div className="space-y-1">
                  <Label>Share Code (optional)</Label>
                  <Input
                    value={form.share_code}
                    onChange={e => setForm(f => ({ ...f, share_code: e.target.value }))}
                    placeholder="e.g. W3L-4NB-XYZ"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={handleSave} disabled={completeMutation.isPending}>
                <Check className="h-3 w-3 mr-1" />
                {completeMutation.isPending ? 'Saving...' : 'Save'}
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
