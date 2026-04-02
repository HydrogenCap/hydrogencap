import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Users,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  ChevronDown,
  Search,
  Download,
  Plus,
  Send,
  Smartphone,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useCommunications, useExportCommunications } from '@/hooks/useCommunicationLog';
import { LogCommunication } from './LogCommunication';
import type {
  CommunicationRecord,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationRelatedType,
  CommunicationFilters,
} from '@/hooks/useCommunicationLog';

const CHANNEL_ICONS: Record<CommunicationChannel, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: Smartphone,
  phone: Phone,
  letter: FileText,
  in_person: Users,
  portal: Globe,
  whatsapp: MessageSquare,
  other: Send,
};

const CHANNEL_LABELS: Record<CommunicationChannel, string> = {
  email: 'Email',
  sms: 'SMS',
  phone: 'Phone',
  letter: 'Letter',
  in_person: 'In Person',
  portal: 'Portal',
  whatsapp: 'WhatsApp',
  other: 'Other',
};

const RELATED_TYPE_LABELS: Record<string, string> = {
  maintenance_request: 'Maintenance',
  rent_arrears: 'Rent Arrears',
  tenancy: 'Tenancy',
  inspection: 'Inspection',
  compliance: 'Compliance',
  possession: 'Possession',
  general: 'General',
};

interface CommunicationTimelineProps {
  propertyId?: string;
  tenantId?: string;
  contractorId?: string;
  relatedToType?: CommunicationRelatedType;
  relatedToId?: string;
  title?: string;
  compact?: boolean;
}

export function CommunicationTimeline({
  propertyId,
  tenantId,
  contractorId,
  relatedToType,
  relatedToId,
  title = 'Communications',
  compact = false,
}: CommunicationTimelineProps) {
  const [showLog, setShowLog] = useState(false);
  const [search, setSearch] = useState('');
  const [dirFilter, setDirFilter] = useState<CommunicationDirection | 'all'>('all');
  const [channelFilter, setChannelFilter] = useState<CommunicationChannel | 'all'>('all');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filters: CommunicationFilters = {
    propertyId,
    tenantId,
    contractorId,
    relatedToType,
    relatedToId,
    search: search || undefined,
    direction: dirFilter === 'all' ? undefined : dirFilter,
    channel: channelFilter === 'all' ? undefined : channelFilter,
  };

  const { data: communications = [], isLoading } = useCommunications(filters);
  const exportQuery = useExportCommunications(filters);

  const filtered = useMemo(() => communications, [communications]);

  const toggleExpanded = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExport = async () => {
    const { data } = await exportQuery.refetch();
    if (!data || data.length === 0) return;

    const csv = [
      ['Date', 'Direction', 'Channel', 'Subject', 'Content', 'Proof of Service', 'Reference'].join(','),
      ...data.map(r => [
        r.sent_at,
        r.direction,
        r.channel,
        `"${(r.subject || '').replace(/"/g, '""')}"`,
        `"${r.content.replace(/"/g, '""')}"`,
        r.proof_of_service || '',
        r.reference_number || '',
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `communications_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exportQuery.isFetching}>
              <Download className="h-3.5 w-3.5 mr-1" /> Export
            </Button>
            <Button size="sm" onClick={() => setShowLog(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Log
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!compact && (
            <div className="flex flex-wrap gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search communications..."
                  className="pl-9"
                />
              </div>
              <Select value={dirFilter} onValueChange={v => setDirFilter(v as CommunicationDirection | 'all')}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                </SelectContent>
              </Select>
              <Select value={channelFilter} onValueChange={v => setChannelFilter(v as CommunicationChannel | 'all')}>
                <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All channels</SelectItem>
                  {Object.entries(CHANNEL_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading communications...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No communications recorded yet.
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

              <div className="space-y-0">
                {filtered.map(comm => (
                  <TimelineEntry
                    key={comm.id}
                    comm={comm}
                    isExpanded={expandedIds.has(comm.id)}
                    onToggle={() => toggleExpanded(comm.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <LogCommunication
        open={showLog}
        onOpenChange={setShowLog}
        defaultPropertyId={propertyId}
        defaultTenantId={tenantId}
        defaultContractorId={contractorId}
        defaultRelatedToType={relatedToType}
        defaultRelatedToId={relatedToId}
      />
    </>
  );
}

function TimelineEntry({
  comm,
  isExpanded,
  onToggle,
}: {
  comm: CommunicationRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const ChannelIcon = CHANNEL_ICONS[comm.channel];
  const isOutbound = comm.direction === 'outbound';
  const DirectionIcon = isOutbound ? ArrowUpRight : ArrowDownLeft;
  const dirColor = isOutbound
    ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
    : 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
  const dotColor = isOutbound ? 'bg-blue-500' : 'bg-green-500';

  const preview = comm.content.length > 120 ? comm.content.slice(0, 120) + '...' : comm.content;
  const attachments = (comm.attachments || []) as { name: string; url: string; type: string }[];

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className="relative pl-10 pb-4">
        {/* Timeline dot */}
        <div className={`absolute left-2.5 top-2 h-3 w-3 rounded-full border-2 border-background ${dotColor}`} />

        <CollapsibleTrigger asChild>
          <button className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${dirColor}`}>
                  <DirectionIcon className="h-3 w-3" />
                  {isOutbound ? 'Out' : 'In'}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <ChannelIcon className="h-3 w-3" />
                  {CHANNEL_LABELS[comm.channel]}
                </span>
                {comm.related_to_type && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {RELATED_TYPE_LABELS[comm.related_to_type] || comm.related_to_type}
                  </Badge>
                )}
                {comm.proof_of_service && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-green-500/10 text-green-700 dark:text-green-400">
                    Proof: {comm.proof_of_service.replace(/_/g, ' ')}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(comm.sent_at), { addSuffix: true })}
                </span>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </div>
            </div>
            {comm.subject && (
              <p className="text-sm font-medium mt-1">{comm.subject}</p>
            )}
            {!isExpanded && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preview}</p>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="mt-2 rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="text-sm whitespace-pre-wrap">{comm.content}</div>

            {attachments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Attachments</p>
                <div className="flex flex-wrap gap-2">
                  {attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <FileText className="h-3 w-3" />
                      {att.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground border-t pt-2">
              <span>Sent: {format(new Date(comm.sent_at), 'dd MMM yyyy HH:mm')}</span>
              {comm.delivered_at && <span>Delivered: {format(new Date(comm.delivered_at), 'dd MMM yyyy HH:mm')}</span>}
              {comm.read_at && <span>Read: {format(new Date(comm.read_at), 'dd MMM yyyy HH:mm')}</span>}
              {comm.reference_number && <span>Ref: {comm.reference_number}</span>}
              {comm.witness_name && <span>Witness: {comm.witness_name}</span>}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
