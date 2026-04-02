import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Bell, ChevronDown, ChevronUp, Check, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SEVERITY } from '@/lib/design-tokens';
import { useRegulatoryAlerts, useAcknowledgeAlert, useDismissAlert } from '@/hooks/useRegulatoryAlerts';
import type { RegulatoryAlert } from '@/hooks/useRegulatoryAlerts';

const SEVERITY_ICON: Record<string, typeof AlertTriangle> = {
  critical: AlertTriangle,
  warning: AlertTriangle,
  info: Bell,
};

function AlertItem({ alert }: { alert: RegulatoryAlert }) {
  const [expanded, setExpanded] = useState(false);
  const acknowledge = useAcknowledgeAlert();
  const dismiss = useDismissAlert();

  const sev = alert.severity as keyof typeof SEVERITY;
  const tokens = SEVERITY[sev] || SEVERITY.info;
  const Icon = SEVERITY_ICON[alert.severity] || Bell;

  return (
    <div className={`rounded-lg border ${tokens.border} ${tokens.bg} p-3`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${tokens.text}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${tokens.text}`}>{alert.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${tokens.badge}`}>
              {alert.severity}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{alert.summary}</p>
          {expanded && alert.details && (
            <p className="text-xs text-muted-foreground mt-2">{alert.details}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setExpanded(!expanded)}
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
          {!alert.acknowledged_at && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => acknowledge.mutate(alert.id)}
              disabled={acknowledge.isPending}
              aria-label="Acknowledge"
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => dismiss.mutate(alert.id)}
            disabled={dismiss.isPending}
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RegulatoryAlertsBanner() {
  const { data: alerts } = useRegulatoryAlerts();

  const activeAlerts = (alerts || []).filter(
    (a) => !a.dismissed && (a.severity === 'critical' || a.severity === 'warning')
  );

  if (activeAlerts.length === 0) return null;

  const criticalCount = activeAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={`h-4 w-4 ${criticalCount > 0 ? 'text-red-500' : 'text-amber-500'}`} />
          <span className="text-sm font-medium">
            {activeAlerts.length} regulatory alert{activeAlerts.length === 1 ? '' : 's'}
          </span>
        </div>
        <Link to="/regulatory-monitor">
          <Button variant="ghost" size="sm" className="text-xs gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </Link>
      </div>
      <div className="space-y-2">
        {activeAlerts.slice(0, 3).map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
        {activeAlerts.length > 3 && (
          <Link to="/regulatory-monitor">
            <p className="text-xs text-muted-foreground text-center hover:underline">
              +{activeAlerts.length - 3} more alert{activeAlerts.length - 3 === 1 ? '' : 's'}
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}
