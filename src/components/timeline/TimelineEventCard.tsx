import { Link } from 'react-router-dom';
import {
  Building2,
  TrendingUp,
  Landmark,
  Percent,
  FileCheck,
  Award,
  MessageSquare,
  Calendar,
  ArrowUpRight,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { TimelineEvent, TimelineEventType } from '@/hooks/usePortfolioTimeline';

const eventIcons: Record<TimelineEventType, React.ElementType> = {
  acquisition: Building2,
  disposal: Building2,
  valuation_milestone: TrendingUp,
  mortgage_start: Landmark,
  refinance: Landmark,
  rate_change: Percent,
  rate_expiry: Percent,
  hmo_licence: FileCheck,
  epc_update: FileCheck,
  performance_highlight: Award,
  note: MessageSquare,
};

const categoryColors: Record<string, string> = {
  expansion: 'bg-emerald-500',
  finance: 'bg-blue-500',
  compliance: 'bg-amber-500',
  performance: 'bg-purple-500',
};

const severityBorders: Record<string, string> = {
  positive: 'border-l-emerald-500',
  neutral: 'border-l-border',
  warning: 'border-l-amber-500',
};

interface TimelineEventCardProps {
  event: TimelineEvent;
  showSnapshot?: boolean;
}

export function TimelineEventCard({ event, showSnapshot = false }: TimelineEventCardProps) {
  const Icon = eventIcons[event.type] || Calendar;
  const categoryColor = categoryColors[event.category] || 'bg-muted';
  const severityBorder = severityBorders[event.severity || 'neutral'];

  return (
    <Card className={cn('border-l-4 transition-shadow hover:shadow-md', severityBorder)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn('rounded-full p-2', categoryColor, 'text-white shrink-0')}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-foreground">{event.title}</h4>
                {event.subtitle && (
                  <p className="text-sm text-muted-foreground">{event.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className="text-xs">
                  {event.date.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Badge>
              </div>
            </div>

            {/* Description */}
            {event.description && (
              <p className="text-sm text-muted-foreground">{event.description}</p>
            )}

            {/* Metrics */}
            {event.metrics && Object.keys(event.metrics).length > 0 && (
              <div className="flex flex-wrap gap-4 pt-1">
                {Object.entries(event.metrics).map(([key, value]) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <div className="text-sm">
                        <span className="text-muted-foreground">{key}: </span>
                        <span className="font-medium text-foreground">{value ?? '—'}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{key}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            )}

            {/* Snapshot preview */}
            {showSnapshot && event.snapshot && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-2">Portfolio at this point</p>
                <div className="grid grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground">Properties</span>
                    <p className="font-semibold">{event.snapshot.propertyCount}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Value</span>
                    <p className="font-semibold">£{(event.snapshot.totalValue / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Equity</span>
                    <p className="font-semibold">£{(event.snapshot.equity / 1000).toFixed(0)}k</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">LTV</span>
                    <p className="font-semibold">{event.snapshot.averageLTV?.toFixed(0) ?? '—'}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Link to property */}
            {event.propertyId && (
              <Link
                to={`/properties/${event.propertyId}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                View property
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
