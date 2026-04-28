import { Shield, Wrench, Percent, Flame, Zap, Home, Building2, FileCheck } from 'lucide-react';
import type { CalendarEventType } from '@/hooks/useCalendarEvents';

export interface ComplianceEvent {
  id: string;
  propertyId: string;
  address: string;
  date: Date;
  type: string;
  typeLabel: string;
  daysUntil: number;
  status: 'valid' | 'expiring_soon' | 'expired' | 'missing';
  issueDate?: string | null;
}

export const EVENT_TYPE_CONFIG: Record<CalendarEventType, { icon: React.ElementType; color: string; bgColor: string; label: string }> = {
  compliance: { icon: Shield, color: 'bg-blue-500', bgColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300', label: 'Compliance' },
  job: { icon: Wrench, color: 'bg-amber-500', bgColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', label: 'Jobs' },
  mortgage: { icon: Percent, color: 'bg-purple-500', bgColor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300', label: 'Mortgage' },
};

export const COMPLIANCE_ICONS: Record<string, React.ElementType> = {
  GAS_SAFETY: Flame,
  EICR: Zap,
  EPC: Home,
  HMO_LICENCE: Building2,
  FIRE_ALARM: Shield,
  EMERGENCY_LIGHTING: Shield,
  LEGIONELLA: Shield,
  PAT_TESTING: Zap,
};

export const COMPLIANCE_LABELS: Record<string, string> = {
  GAS_SAFETY: 'Gas Safety',
  EICR: 'EICR',
  EPC: 'EPC',
  HMO_LICENCE: 'HMO Licence',
  FIRE_ALARM: 'Fire Alarm',
  EMERGENCY_LIGHTING: 'Emergency Lighting',
  LEGIONELLA: 'Legionella',
  PAT_TESTING: 'PAT Testing',
};

export function getEventIcon(type: string): React.ElementType {
  return COMPLIANCE_ICONS[type] || FileCheck;
}

import type { CalendarEvent } from '@/hooks/useCalendarEvents';

export function getEventColor(event: CalendarEvent): string {
  if (event.urgency === 'overdue') return 'bg-destructive';
  if (event.urgency === 'urgent') return 'bg-amber-500';
  if (event.urgency === 'warning') return 'bg-yellow-500';
  if (event.eventType === 'job') return 'bg-amber-500';
  if (event.eventType === 'mortgage') return 'bg-purple-500';
  return 'bg-emerald-500';
}
