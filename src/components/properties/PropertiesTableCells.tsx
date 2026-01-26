// ============================================
// PROPERTIES TABLE CELL RENDERERS
// Reusable cell components and display helpers
// ============================================

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TableHead } from '@/components/ui/table';
import { ArrowUpDown } from 'lucide-react';
import { formatDateUK, formatPercent, getLTVStatus, getExpiryStatus, getEPCStatus } from '@/lib/calculations';
import { type PropertyWithFinancials } from '@/hooks/useProperties';
import { type RiskLevel } from '@/lib/propertyMetrics';
import { type ColumnKey } from '@/lib/propertiesTableConfig';

// ============================================
// SORTABLE HEADER COMPONENT
// ============================================

interface SortableHeaderProps {
  field: ColumnKey;
  children: React.ReactNode;
  align?: 'left' | 'right';
  onSort: (field: ColumnKey) => void;
}

export function SortableHeader({ field, children, align = 'left', onSort }: SortableHeaderProps) {
  return (
    <TableHead className={align === 'right' ? 'text-right' : ''}>
      <Button 
        variant="ghost" 
        size="sm" 
        className={`-ml-3 h-8 hover:bg-transparent ${align === 'right' ? 'ml-auto -mr-3' : ''}`}
        onClick={(e) => { e.stopPropagation(); onSort(field); }}
      >
        {children}
        <ArrowUpDown className="ml-2 h-3 w-3 opacity-50" />
      </Button>
    </TableHead>
  );
}

// ============================================
// BADGE RENDERERS
// ============================================

export function ExpiryBadge({ date }: { date: string | null | undefined }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  
  const status = getExpiryStatus(date);
  let colorClass = 'text-success';
  if (status === 'expired') colorClass = 'text-destructive';
  else if (status === 'critical' || status === 'warning') colorClass = 'text-warning';
  
  return <span className={colorClass}>{formatDateUK(date)}</span>;
}

export function LTVBadge({ ltv }: { ltv: number | null }) {
  if (ltv === null) return <span className="text-muted-foreground">—</span>;
  
  const status = getLTVStatus(ltv);
  let colorClass = '';
  if (status === 'danger') colorClass = 'text-destructive';
  else if (status === 'warning') colorClass = 'text-warning';
  
  return <span className={colorClass}>{formatPercent(ltv)}</span>;
}

export function EPCBadge({ rating, required }: { rating: string | null; required: boolean | null }) {
  if (required === false) {
    return <Badge variant="outline" className="text-xs">N/A</Badge>;
  }
  if (!rating) return <span className="text-muted-foreground">—</span>;
  
  const status = getEPCStatus(rating, required ?? true);
  let colorClass = 'text-success';
  if (status === 'warning') colorClass = 'text-warning';
  else if (status === 'exempt') colorClass = 'text-muted-foreground';
  
  return <Badge variant="outline" className={`${colorClass} border-current`}>{rating}</Badge>;
}

export function RiskBadge({ level, issues }: { level: RiskLevel; issues: string[] }) {
  const colors: Record<RiskLevel, string> = {
    critical: 'bg-destructive text-destructive-foreground',
    warning: 'bg-warning text-warning-foreground',
    ok: 'bg-success text-success-foreground',
  };
  const labels: Record<RiskLevel, string> = {
    critical: 'RED',
    warning: 'YELLOW',
    ok: 'GREEN',
  };
  
  return (
    <Badge className={colors[level]} title={issues.join(', ')}>
      {labels[level]}
    </Badge>
  );
}

// ============================================
// OWNERSHIP DISPLAY
// ============================================

interface OwnershipDisplayProps {
  property: PropertyWithFinancials;
  companyMap: Map<string, string> | undefined;
}

export function OwnershipDisplay({ property, companyMap }: OwnershipDisplayProps) {
  // Use legal_owner_company_id to get company name
  if (property.legal_owner_company_id && companyMap) {
    const companyName = companyMap.get(property.legal_owner_company_id);
    if (companyName) {
      return <span>{companyName}</span>;
    }
  }
  // Fallback to legacy ownership_entity field
  if (property.ownership_entity) {
    return <span>{property.ownership_entity}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

// ============================================
// VALUE DISPLAY HELPERS
// ============================================

export function CashflowValue({ value }: { value: number | null }) {
  if (value === null) return <span>—</span>;
  return (
    <span className={value >= 0 ? 'text-success' : 'text-destructive'}>
      {new Intl.NumberFormat('en-GB', { 
        style: 'currency', 
        currency: 'GBP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value)}
    </span>
  );
}

export function MeterDisplay({ location, number }: { location?: string | null; number?: string | null }) {
  if (!location) {
    return <span className="text-warning">Missing</span>;
  }
  return (
    <span className="block truncate" title={location}>
      {location}
      {number && <span className="block text-foreground"># {number}</span>}
    </span>
  );
}
