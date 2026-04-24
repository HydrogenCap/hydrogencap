import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Mail,
  Phone,
  MessageSquare,
  FileText,
  Users,
  Globe,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Send,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { format, startOfMonth, isAfter } from 'date-fns';
import { useCommunications } from '@/hooks/useCommunicationLog';
import { CommunicationTimeline } from '@/components/communications/CommunicationTimeline';
import { LogCommunication } from '@/components/communications/LogCommunication';
import { TEXT } from '@/lib/design-tokens';
import type {
  CommunicationChannel,
  CommunicationDirection,
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

export default function Communications() {
  const [showLog, setShowLog] = useState(false);
  const [_dirFilter, _setDirFilter] = useState<CommunicationDirection | 'all'>('all');
  const [_channelFilter, _setChannelFilter] = useState<CommunicationChannel | 'all'>('all');

  const { data: allComms = [] } = useCommunications();

  const monthStart = startOfMonth(new Date());
  const stats = useMemo(() => {
    const thisMonth = allComms.filter(c => isAfter(new Date(c.sent_at), monthStart));
    const channelBreakdown = thisMonth.reduce<Record<string, number>>((acc, c) => {
      acc[c.channel] = (acc[c.channel] || 0) + 1;
      return acc;
    }, {});
    const outbound = thisMonth.filter(c => c.direction === 'outbound').length;
    const inbound = thisMonth.filter(c => c.direction === 'inbound').length;

    return {
      total: thisMonth.length,
      outbound,
      inbound,
      channelBreakdown,
    };
  }, [allComms, monthStart]);

  const topChannel = useMemo(() => {
    const entries = Object.entries(stats.channelBreakdown);
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0];
  }, [stats.channelBreakdown]);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className={TEXT.pageTitle}>Communications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Immutable audit trail for Section 8 possession evidence
            </p>
          </div>
          <Button onClick={() => setShowLog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Log Communication
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowUpRight className="h-3 w-3 text-blue-500" /> Outbound
              </p>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{stats.outbound}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ArrowDownLeft className="h-3 w-3 text-green-500" /> Inbound
              </p>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">{stats.inbound}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> Top Channel
              </p>
              {topChannel ? (
                <div className="flex items-center gap-2 mt-1">
                  {(() => {
                    const Icon = CHANNEL_ICONS[topChannel[0] as CommunicationChannel];
                    return Icon ? <Icon className="h-4 w-4 text-muted-foreground" /> : null;
                  })()}
                  <span className="text-lg font-bold">
                    {CHANNEL_LABELS[topChannel[0] as CommunicationChannel] || topChannel[0]}
                  </span>
                  <Badge variant="secondary" className="text-xs">{topChannel[1]}</Badge>
                </div>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">--</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Channel Breakdown */}
        {Object.keys(stats.channelBreakdown).length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Channel Breakdown — {format(monthStart, 'MMMM yyyy')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.channelBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .map(([channel, count]) => {
                    const Icon = CHANNEL_ICONS[channel as CommunicationChannel];
                    return (
                      <div key={channel} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-sm font-medium">
                          {CHANNEL_LABELS[channel as CommunicationChannel] || channel}
                        </span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Full Timeline */}
        <CommunicationTimeline title="All Communications" />
      </div>

      <LogCommunication open={showLog} onOpenChange={setShowLog} />
    </AppLayout>
  );
}
