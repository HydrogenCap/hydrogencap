import React from 'react';
import { Badge } from '@/components/ui/badge';
import { MapPin, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { GeocodeStatus } from '@/hooks/useGeocoding';

interface GeocodeStatusBadgeProps {
  status: GeocodeStatus | string | null;
  confidence?: 'exact' | 'approximate' | 'unknown' | string | null;
  error?: string | null;
  showLabel?: boolean;
}

export function GeocodeStatusBadge({ 
  status, 
  confidence, 
  error, 
  showLabel = true 
}: GeocodeStatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'SUCCESS':
        if (confidence === 'exact') {
          return {
            variant: 'default' as const,
            icon: MapPin,
            label: 'Location verified',
            className: 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success))]',
          };
        }
        return {
          variant: 'secondary' as const,
          icon: AlertTriangle,
          label: 'Location approximate',
          className: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]',
        };
      case 'PARTIAL':
        return {
          variant: 'secondary' as const,
          icon: AlertTriangle,
          label: 'Location approximate',
          className: 'bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))] hover:bg-[hsl(var(--warning))]',
        };
      case 'FAILED':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          label: 'Location failed',
          className: '',
        };
      case 'NOT_STARTED':
      default:
        return {
          variant: 'outline' as const,
          icon: HelpCircle,
          label: 'Not geocoded',
          className: '',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className={`gap-1 ${config.className}`}>
      <Icon className="h-3 w-3" />
      {showLabel && config.label}
    </Badge>
  );

  if (error) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent>
            <p className="text-sm">{error}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return badge;
}
