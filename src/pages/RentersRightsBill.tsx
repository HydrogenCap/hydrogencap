import { useState, useEffect } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import {
  ShieldCheck, AlertTriangle, Clock, Check, X, Plus, Pencil, ExternalLink, Info,
  FileText, Home, Users, Gavel,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAppSettings, useUpdateAppSetting } from '@/hooks/useAppSettings';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────────────────

interface AwaaabComplaint {
  id: string;
  property: string;
  description: string;
  reported_date: string; // ISO date string
}

interface DecentHomesItem {
  key: string;
  label: string;
  description: string;
  confirmed: boolean;
  confirmed_date?: string;
}

// ─── Decent Homes checklist template ────────────────────────────────────────

const DECENT_HOMES_TEMPLATE: Omit<DecentHomesItem, 'confirmed' | 'confirmed_date'>[] = [
  {
    key: 'hazard_free',
    label: 'Category 1 Hazard Free (HHSRS)',
    description: 'No Category 1 hazards under the Housing Health & Safety Rating System (e.g. damp, excess cold, falls).',
  },
  {
    key: 'reasonable_repair',
    label: 'Reasonable State of Repair',
    description: 'Key building components (roof, windows, doors, plumbing, heating) not in a state of disrepair.',
  },
  {
    key: 'modern_facilities',
    label: 'Modern Facilities & Services',
    description: 'Kitchen ≤ 20 years old, bathroom ≤ 30 years old, adequate noise insulation.',
  },
  {
    key: 'thermal_comfort',
    label: 'Thermal Comfort',
    description: 'Effective and efficient fixed heating with appropriate insulation (loft, walls).',
  },
  {
    key: 'clean_on_entry',
    label: 'Clean & Safe on Entry',
    description: 'Property provided in a clean condition with working smoke/CO alarms and secure entry points.',
  },
];

const STORAGE_KEY_AWAAB = 'rrb_awaab_complaints';
const STORAGE_KEY_DECENT = 'rrb_decent_homes';

function loadAwaaab(): AwaaabComplaint[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY_AWAAB) || '[]'); } catch { return []; }
}
function saveAwaaab(items: AwaaabComplaint[]) {
  localStorage.setItem(STORAGE_KEY_AWAAB, JSON.stringify(items));
}
function loadDecent(): DecentHomesItem[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_DECENT) || '{}') as Record<string, { confirmed: boolean; confirmed_date?: string }>;
    return DECENT_HOMES_TEMPLATE.map(t => ({
      ...t,
      confirmed: stored[t.key]?.confirmed ?? false,
      confirmed_date: stored[t.key]?.confirmed_date,
    }));
  } catch {
    return DECENT_HOMES_TEMPLATE.map(t => ({ ...t, confirmed: false }));
  }
}
function saveDecent(items: DecentHomesItem[]) {
  const out: Record<string, { confirmed: boolean; confirmed_date?: string }> = {};
  for (const item of items) {
    out[item.key] = { confirmed: item.confirmed, confirmed_date: item.confirmed_date };
  }
  localStorage.setItem(STORAGE_KEY_DECENT, JSON.stringify(out));
}

function awaaabStatus(daysElapsed: number): { label: string; variant: 'destructive' | 'secondary'; color: string } {
  if (daysElapsed > 14) return { label: `${daysElapsed}d — OVERDUE`, variant: 'destructive', color: 'text-destructive' };
  if (daysElapsed >= 8) return { label: `${daysElapsed}d — Urgent`, variant: 'destructive', color: 'text-amber-600' };
  return { label: `${daysElapsed}d`, variant: 'secondary', color: 'text-emerald-600' };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RentersRightsBill() {
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useAppSettings();
  const updateSetting = useUpdateAppSetting();

  // Registration numbers edit state
  const [editingOmbudsman, setEditingOmbudsman] = useState(false);
  const [ombudsmanDraft, setOmbudsmanDraft] = useState('');
  const [editingPortal, setEditingPortal] = useState(false);
  const [portalDraft, setPortalDraft] = useState('');

  // Awaab's Law
  const [complaints, setComplaints] = useState<AwaaabComplaint[]>([]);
  const [showAddComplaint, setShowAddComplaint] = useState(false);
  const [newComplaint, setNewComplaint] = useState({ property: '', description: '', reported_date: new Date().toISOString().split('T')[0] });

  // Decent Homes
  const [decentItems, setDecentItems] = useState<DecentHomesItem[]>([]);

  useEffect(() => {
    setComplaints(loadAwaaab());
    setDecentItems(loadDecent());
  }, []);

  const ombudsmanNumber = settings?.['rrb_ombudsman_number'] || '';
  const portalNumber = settings?.['rrb_property_portal_number'] || '';

  const saveOmbudsman = async () => {
    await updateSetting.mutateAsync({ key: 'rrb_ombudsman_number', value: ombudsmanDraft });
    setEditingOmbudsman(false);
  };
  const savePortal = async () => {
    await updateSetting.mutateAsync({ key: 'rrb_property_portal_number', value: portalDraft });
    setEditingPortal(false);
  };

  const addComplaint = () => {
    if (!newComplaint.property || !newComplaint.reported_date) return;
    const updated = [...complaints, { ...newComplaint, id: crypto.randomUUID() }];
    setComplaints(updated);
    saveAwaaab(updated);
    setNewComplaint({ property: '', description: '', reported_date: new Date().toISOString().split('T')[0] });
    setShowAddComplaint(false);
    toast({ title: 'Complaint logged' });
  };

  const removeComplaint = (id: string) => {
    const updated = complaints.filter(c => c.id !== id);
    setComplaints(updated);
    saveAwaaab(updated);
  };

  const toggleDecent = (key: string) => {
    const updated = decentItems.map(item =>
      item.key === key
        ? { ...item, confirmed: !item.confirmed, confirmed_date: !item.confirmed ? new Date().toISOString().split('T')[0] : undefined }
        : item
    );
    setDecentItems(updated);
    saveDecent(updated);
  };

  const decentScore = decentItems.filter(i => i.confirmed).length;
  const decentPct = Math.round((decentScore / decentItems.length) * 100);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gavel className="h-6 w-6" />
            Renters' Rights Bill
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Track compliance with the Renters' Rights Act 2025 — key obligations, registration numbers and deadline timers.
          </p>
        </div>

        {/* Key provisions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="h-4 w-4" />
              Key Provisions & Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {PROVISIONS.map(p => (
                <div key={p.title} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
                  <p.icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <div>
                    <p className="font-medium">{p.title}</p>
                    <p className="text-muted-foreground text-xs mt-0.5">{p.detail}</p>
                    <Badge variant="secondary" className="mt-1 text-xs">{p.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
            <a
              href="https://www.legislation.gov.uk/ukpga/2025/1/contents"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
            >
              Renters' Rights Act 2025 on legislation.gov.uk <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* Registration numbers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ombudsman Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editingOmbudsman ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Registration Number</p>
                    <p className={`font-medium ${ombudsmanNumber ? '' : 'text-muted-foreground'}`}>
                      {settingsLoading ? '…' : ombudsmanNumber || 'Not recorded'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {ombudsmanNumber
                      ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      : <AlertTriangle className="h-4 w-4 text-amber-600" />
                    }
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setOmbudsmanDraft(ombudsmanNumber); setEditingOmbudsman(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input value={ombudsmanDraft} onChange={e => setOmbudsmanDraft(e.target.value)} placeholder="e.g. OM-12345678" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveOmbudsman} disabled={updateSetting.isPending}>
                      <Check className="h-3 w-3 mr-1" />Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingOmbudsman(false)}>
                      <X className="h-3 w-3 mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              )}
              {!ombudsmanNumber && !editingOmbudsman && (
                <p className="text-xs text-amber-600">
                  ⚠️ Mandatory membership required under the Renters' Rights Act. Register at the government-approved scheme.
                </p>
              )}
              <a href="https://www.gov.uk/government/consultations/new-ombudsman-for-the-private-rented-sector" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Private Rented Sector Ombudsman <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Home className="h-4 w-4" />
                Property Portal Registration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!editingPortal ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Registration Number</p>
                    <p className={`font-medium ${portalNumber ? '' : 'text-muted-foreground'}`}>
                      {settingsLoading ? '…' : portalNumber || 'Not recorded'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {portalNumber
                      ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      : <AlertTriangle className="h-4 w-4 text-amber-600" />
                    }
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setPortalDraft(portalNumber); setEditingPortal(true); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Registration Number</Label>
                  <Input value={portalDraft} onChange={e => setPortalDraft(e.target.value)} placeholder="e.g. PRP-87654321" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={savePortal} disabled={updateSetting.isPending}>
                      <Check className="h-3 w-3 mr-1" />Save
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setEditingPortal(false)}>
                      <X className="h-3 w-3 mr-1" />Cancel
                    </Button>
                  </div>
                </div>
              )}
              {!portalNumber && !editingPortal && (
                <p className="text-xs text-amber-600">
                  ⚠️ All landlords must register on the Property Portal before letting. Failure is a criminal offence.
                </p>
              )}
              <a href="https://www.gov.uk/government/news/new-property-portal-to-drive-up-standards-in-private-rented-sector" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Private Rented Sector Property Portal <ExternalLink className="h-3 w-3" />
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Awaab's Law complaint tracker */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Awaab's Law — Damp & Mould Complaint Tracker
              </CardTitle>
              <Button size="sm" variant="outline" onClick={() => setShowAddComplaint(v => !v)}>
                <Plus className="h-3 w-3 mr-1" />Log Complaint
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="rounded-md bg-muted/40 text-xs p-2 text-muted-foreground">
              Under Awaab's Law: investigate within <strong>14 days</strong>, emergency repairs within <strong>24 hours</strong>, all repairs within a <strong>reasonable timeframe</strong>. Failure is a breach of the tenancy agreement.
            </div>

            {showAddComplaint && (
              <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Property / Room</Label>
                    <Input value={newComplaint.property} onChange={e => setNewComplaint(p => ({ ...p, property: e.target.value }))} placeholder="e.g. 42 High Street, Room 3" />
                  </div>
                  <div className="space-y-1">
                    <Label>Date Reported</Label>
                    <Input type="date" value={newComplaint.reported_date} onChange={e => setNewComplaint(p => ({ ...p, reported_date: e.target.value }))} />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Description</Label>
                    <Textarea value={newComplaint.description} onChange={e => setNewComplaint(p => ({ ...p, description: e.target.value }))} placeholder="Brief description of the damp/mould complaint…" rows={2} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={addComplaint}><Check className="h-3 w-3 mr-1" />Save</Button>
                  <Button size="sm" variant="outline" onClick={() => setShowAddComplaint(false)}><X className="h-3 w-3 mr-1" />Cancel</Button>
                </div>
              </div>
            )}

            {complaints.length === 0 && !showAddComplaint ? (
              <p className="text-muted-foreground text-center py-4">No complaints logged.</p>
            ) : complaints.length > 0 ? (
              <div className="space-y-2">
                {complaints.map(c => {
                  const days = differenceInDays(new Date(), parseISO(c.reported_date));
                  const { label, variant, color } = awaaabStatus(days);
                  return (
                    <div key={c.id} className="flex items-start justify-between gap-3 border rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{c.property}</span>
                          <Badge variant={variant} className="text-xs">{label}</Badge>
                        </div>
                        {c.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>}
                        <p className="text-xs text-muted-foreground">Reported: {format(parseISO(c.reported_date), 'dd MMM yyyy')}</p>
                      </div>
                      <Button size="sm" variant="ghost" className="text-destructive h-7 w-7 p-0 shrink-0" onClick={() => removeComplaint(c.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Decent Homes Standard */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Decent Homes Standard
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">{decentScore}/{decentItems.length}</span>
                <Badge className={decentPct === 100 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : decentPct >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-destructive/10 text-destructive'}>
                  {decentPct}%
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground">Tick each criterion once you have verified it for your portfolio. Dates are recorded locally.</p>
            {decentItems.map(item => (
              <div
                key={item.key}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${item.confirmed ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'hover:bg-muted/40'}`}
                onClick={() => toggleDecent(item.key)}
              >
                <div className={`mt-0.5 flex-shrink-0 h-5 w-5 rounded border-2 flex items-center justify-center transition-colors ${item.confirmed ? 'bg-emerald-600 border-emerald-600' : 'border-muted-foreground'}`}>
                  {item.confirmed && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium ${item.confirmed ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                  {item.confirmed && item.confirmed_date && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">Confirmed {format(parseISO(item.confirmed_date), 'dd MMM yyyy')}</p>
                  )}
                </div>
              </div>
            ))}
            {decentPct < 100 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 text-xs p-2 mt-2">
                ⚠️ The Decent Homes Standard will apply to private rented properties. Properties not meeting the standard may be subject to enforcement action by local authorities.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

// ─── Provisions data ─────────────────────────────────────────────────────────

const PROVISIONS = [
  {
    icon: Gavel,
    title: 'Section 21 Abolition',
    detail: '"No-fault" evictions banned. Landlords may only evict using Section 8 grounds.',
    status: 'In force — 2025',
  },
  {
    icon: Home,
    title: 'Property Portal',
    detail: 'All landlords must register on the government Property Portal before letting. Failure is a criminal offence.',
    status: 'In force — 2025',
  },
  {
    icon: Users,
    title: 'Private Rented Sector Ombudsman',
    detail: 'Mandatory membership of the new PRS Ombudsman for all landlords. Tenants can escalate complaints.',
    status: 'In force — 2025',
  },
  {
    icon: Clock,
    title: "Awaab's Law",
    detail: 'Investigate damp/mould within 14 days. Emergency fixes within 24 hours. All repairs within a reasonable timeframe.',
    status: 'In force — 2025',
  },
  {
    icon: FileText,
    title: 'Decent Homes Standard',
    detail: 'Category 1 hazard-free, reasonable repair, modern facilities, thermal comfort — now applies to private rentals.',
    status: 'Commencement date TBC',
  },
  {
    icon: AlertTriangle,
    title: 'Rental Bidding Ban',
    detail: 'Landlords and agents cannot invite or accept bids above the advertised rent.',
    status: 'In force — 2025',
  },
  {
    icon: ShieldCheck,
    title: 'Pets',
    detail: 'Landlords cannot unreasonably refuse a tenant\'s written request to keep a pet.',
    status: 'In force — 2025',
  },
  {
    icon: FileText,
    title: 'Fixed-term Tenancies Abolished',
    detail: 'All new and existing tenancies become periodic. Minimum 2-month notice to quit by tenant.',
    status: 'In force — 2025',
  },
];
