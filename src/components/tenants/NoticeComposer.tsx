import { useState } from 'react';
import { format } from 'date-fns';
import { FileText, Send, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  useTenantNotices,
  useCreateNotice,
} from '@/hooks/useTenantLifecycle';
import type { NoticeType, NoticeStatus, ServedMethod, TenantNotice } from '@/hooks/useTenantLifecycle';

// ============================================================
// Notice Templates
// ============================================================

const NOTICE_TEMPLATES: { value: NoticeType; label: string; description: string }[] = [
  { value: 'section_8', label: 'Section 8', description: 'Notice seeking possession on grounds' },
  { value: 'section_13', label: 'Section 13', description: 'Rent increase notice for periodic tenancy' },
  { value: 'section_21', label: 'Section 21', description: 'No-fault possession notice' },
  { value: 'rent_arrears_warning', label: 'Rent Arrears Warning', description: 'Warning letter for overdue rent' },
  { value: 'property_access', label: 'Property Access', description: 'Notice of entry for inspection or works' },
  { value: 'welcome', label: 'Welcome Letter', description: 'New tenant welcome and move-in information' },
  { value: 'end_of_tenancy', label: 'End of Tenancy', description: 'End of tenancy confirmation and checkout' },
  { value: 'custom', label: 'Custom', description: 'Free-form notice or letter' },
];

const SERVED_METHODS: { value: ServedMethod; label: string }[] = [
  { value: 'hand_delivery', label: 'Hand Delivery' },
  { value: 'first_class_post', label: 'First Class Post' },
  { value: 'recorded_delivery', label: 'Recorded Delivery' },
  { value: 'email', label: 'Email' },
  { value: 'portal', label: 'Tenant Portal' },
  { value: 'other', label: 'Other' },
];

const NOTICE_STATUS_BG: Record<NoticeStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-700',
  served: 'bg-emerald-100 text-emerald-700',
  acknowledged: 'bg-emerald-100 text-emerald-700',
  expired: 'bg-amber-100 text-amber-700',
  withdrawn: 'bg-red-100 text-red-700',
};

// ============================================================
// Template content generators
// ============================================================

function generateTemplateContent(
  type: NoticeType,
  tenant: { first_name: string; last_name: string },
  property?: { address?: string } | null,
): { subject: string; content: string } {
  const name = `${tenant.first_name} ${tenant.last_name}`;
  const addr = property?.address || '[Property Address]';
  const today = format(new Date(), 'dd MMMM yyyy');

  switch (type) {
    case 'section_8':
      return {
        subject: `Section 8 Notice - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nThis is a formal notice under Section 8 of the Housing Act 1988 seeking possession of the above property.\n\nThe grounds on which the court will be asked to make an order for possession are:\n\n[Specify grounds]\n\nParticulars of each ground:\n\n[Provide details]\n\nThe earliest date on which court proceedings can be brought is: [Date]\n\nDated: ${today}`,
      };
    case 'section_13':
      return {
        subject: `Section 13 Rent Increase Notice - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nThis is a formal notice under Section 13 of the Housing Act 1988 proposing a new rent for the above property.\n\nThe new rent of £[amount] per month will take effect from [date].\n\nIf you consider the proposed rent to be excessive, you may refer it to the First-tier Tribunal (Property Chamber) before the start date.\n\nDated: ${today}`,
      };
    case 'section_21':
      return {
        subject: `Section 21 Notice - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nThis is a formal notice under Section 21 of the Housing Act 1988 requiring you to give up possession of the above property.\n\nYou are required to vacate the property on or after: [Date - minimum 2 months from service]\n\nPlease note that this notice does not end your tenancy. If you do not leave by the date specified, court proceedings may be issued.\n\nDated: ${today}`,
      };
    case 'rent_arrears_warning':
      return {
        subject: `Rent Arrears Warning - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nOur records show that your rent account is currently in arrears by £[amount].\n\nRent due: £[monthly amount]\nLast payment received: [date]\nCurrent arrears: £[amount]\n\nPlease arrange payment immediately to avoid further action. If you are experiencing financial difficulties, please contact us to discuss a repayment plan.\n\nDated: ${today}`,
      };
    case 'property_access':
      return {
        subject: `Notice of Entry - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nWe are writing to notify you that we require access to the property on [date] at [time] for the following purpose:\n\n[Reason for access]\n\nAs required under your tenancy agreement, we are providing at least 24 hours' notice. Please confirm your availability or contact us to arrange an alternative time.\n\nDated: ${today}`,
      };
    case 'welcome':
      return {
        subject: `Welcome to ${addr}`,
        content: `Dear ${name},\n\nWelcome to your new home at ${addr}!\n\nHere are some important details for your tenancy:\n\n- Move-in date: [date]\n- Monthly rent: £[amount]\n- Payment method: [method]\n- Emergency contact: [details]\n- Utility providers: [details]\n\nPlease don't hesitate to contact us if you need anything.\n\nDated: ${today}`,
      };
    case 'end_of_tenancy':
      return {
        subject: `End of Tenancy - ${addr}`,
        content: `Dear ${name},\n\nRe: ${addr}\n\nThis letter confirms the end of your tenancy at the above address effective [date].\n\nCheckout arrangements:\n- Checkout date: [date]\n- Key return: [instructions]\n- Meter readings: Please take final readings on the day of departure\n- Forwarding address: Please provide your forwarding address\n\nDeposit return will be processed within the statutory timeframe following the checkout inspection.\n\nDated: ${today}`,
      };
    default:
      return { subject: '', content: `Dear ${name},\n\nRe: ${addr}\n\n\n\nDated: ${today}` };
  }
}

// ============================================================
// Notice History
// ============================================================

function NoticeHistory({ notices }: { notices: TenantNotice[] }) {
  if (notices.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No notices on record.</p>;
  }

  return (
    <div className="border rounded-lg overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {notices.map((n) => (
            <TableRow key={n.id}>
              <TableCell className="text-sm whitespace-nowrap">
                {format(new Date(n.created_at), 'dd/MM/yyyy')}
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {NOTICE_TEMPLATES.find(t => t.value === n.notice_type)?.label || n.notice_type}
                </Badge>
              </TableCell>
              <TableCell className="text-sm max-w-[200px] truncate">{n.subject}</TableCell>
              <TableCell className="text-sm">
                {SERVED_METHODS.find(m => m.value === n.served_method)?.label || n.served_method || '—'}
              </TableCell>
              <TableCell>
                <Badge className={NOTICE_STATUS_BG[n.status]}>{n.status}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================
// Main Composer
// ============================================================

interface NoticeComposerProps {
  tenantId: string;
  tenancyId?: string | null;
  tenant: { first_name: string; last_name: string };
  property?: { address?: string } | null;
}

export function NoticeComposer({ tenantId, tenancyId, tenant, property }: NoticeComposerProps) {
  const { data: notices, isLoading } = useTenantNotices(tenantId);
  const createNotice = useCreateNotice();
  const { toast } = useToast();

  const [showCompose, setShowCompose] = useState(false);
  const [noticeType, setNoticeType] = useState<NoticeType>('custom');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [servedMethod, setServedMethod] = useState<ServedMethod | ''>('');

  const handleTemplateChange = (type: NoticeType) => {
    setNoticeType(type);
    const generated = generateTemplateContent(type, tenant, property);
    setSubject(generated.subject);
    setContent(generated.content);
  };

  const handleSaveDraft = () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Error', description: 'Subject and content are required.', variant: 'destructive' });
      return;
    }
    createNotice.mutate(
      {
        tenant_id: tenantId,
        tenancy_id: tenancyId ?? null,
        notice_type: noticeType,
        subject: subject.trim(),
        content: content.trim(),
        served_method: servedMethod || null,
        served_at: null,
        proof_of_service: null,
        status: 'draft',
      },
      {
        onSuccess: () => {
          toast({ title: 'Draft saved' });
          resetForm();
        },
      },
    );
  };

  const handleSend = () => {
    if (!subject.trim() || !content.trim()) {
      toast({ title: 'Error', description: 'Subject and content are required.', variant: 'destructive' });
      return;
    }
    if (!servedMethod) {
      toast({ title: 'Error', description: 'Please select a service method.', variant: 'destructive' });
      return;
    }
    createNotice.mutate(
      {
        tenant_id: tenantId,
        tenancy_id: tenancyId ?? null,
        notice_type: noticeType,
        subject: subject.trim(),
        content: content.trim(),
        served_method: servedMethod as ServedMethod,
        served_at: new Date().toISOString(),
        proof_of_service: null,
        status: 'sent',
      },
      {
        onSuccess: () => {
          toast({ title: 'Notice sent', description: 'The notice has been recorded as sent.' });
          resetForm();
        },
      },
    );
  };

  const resetForm = () => {
    setShowCompose(false);
    setNoticeType('custom');
    setSubject('');
    setContent('');
    setServedMethod('');
  };

  return (
    <div className="space-y-4">
      {/* Compose Button / Form */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Notices & Letters
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowCompose(!showCompose)}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Compose
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showCompose && (
            <div className="space-y-4 p-4 bg-muted rounded-lg mb-4">
              {/* Template Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs">Template</Label>
                <Select value={noticeType} onValueChange={(v) => handleTemplateChange(v as NoticeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTICE_TEMPLATES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        <div>
                          <span className="font-medium">{t.label}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Notice subject..." />
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <Label className="text-xs">Content</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Notice content..."
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              {/* Service Method */}
              <div className="space-y-1.5">
                <Label className="text-xs">Service Method</Label>
                <Select value={servedMethod} onValueChange={(v) => setServedMethod(v as ServedMethod)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select service method..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SERVED_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={resetForm}>Cancel</Button>
                <Button size="sm" variant="outline" onClick={handleSaveDraft} disabled={createNotice.isPending}>
                  <Save className="h-3.5 w-3.5 mr-1" /> Save Draft
                </Button>
                <Button size="sm" onClick={handleSend} disabled={createNotice.isPending}>
                  <Send className="h-3.5 w-3.5 mr-1" /> Send Notice
                </Button>
              </div>
            </div>
          )}

          {/* Notice History */}
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Loading notices...</p>
          ) : (
            <NoticeHistory notices={notices ?? []} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
