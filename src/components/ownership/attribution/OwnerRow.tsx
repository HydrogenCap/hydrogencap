import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Building2, User, Users, Eye, FileText, Pencil } from 'lucide-react';
import { formatGBP } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { StakePill } from './StakePill';
import { AttributionOwner } from './types';

interface OwnerRowProps {
  owner: AttributionOwner;
  showActions?: boolean;
}

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-3.5 w-3.5" />,
  COMPANY: <Building2 className="h-3.5 w-3.5" />,
  TRUST: <Users className="h-3.5 w-3.5" />,
  SPV: <Building2 className="h-3.5 w-3.5" />,
  Person: <User className="h-3.5 w-3.5" />,
};

export function OwnerRow({ owner, showActions = true }: OwnerRowProps) {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();

  return (
    <TableRow
      className={cn(
        'transition-all duration-150 group',
        isHovered && 'bg-muted/50 shadow-sm'
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Owner info with type icon */}
      <TableCell className="py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'p-2 rounded-lg transition-colors',
            isHovered ? 'bg-primary/10' : 'bg-muted'
          )}>
            {ownerTypeIcons[owner.ownerType] || <User className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-sm truncate">{owner.ownerName}</div>
            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
              {owner.pathDescription}
            </div>
          </div>
        </div>
      </TableCell>

      {/* Stake percentage pill */}
      <TableCell className="text-right">
        <StakePill
          percent={owner.effectivePercent}
          ownerType={owner.ownerType}
          pathDescription={owner.pathDescription}
          ownerId={owner.ownerId}
        />
      </TableCell>

      {/* Divider column - visual separator */}
      <TableCell className="w-px px-0">
        <div className="h-8 w-px bg-border/50" />
      </TableCell>

      {/* Financial columns - neutrals */}
      <TableCell className="text-right text-sm font-medium tabular-nums">
        {formatGBP(owner.attributableValue)}
      </TableCell>
      <TableCell className="text-right text-sm font-medium tabular-nums">
        {formatGBP(owner.attributableEquity)}
      </TableCell>

      {/* Income columns - greens */}
      <TableCell className="text-right text-sm font-medium tabular-nums text-success/80">
        {formatGBP(owner.attributableRent)}
      </TableCell>
      <TableCell className={cn(
        'text-right text-sm font-semibold tabular-nums',
        owner.attributableCashflow >= 0 ? 'text-success' : 'text-destructive'
      )}>
        {formatGBP(owner.attributableCashflow)}
      </TableCell>

      {/* Quick actions - visible on hover */}
      <TableCell className="w-24">
        <div className={cn(
          'flex items-center gap-1 transition-opacity duration-150',
          isHovered ? 'opacity-100' : 'opacity-0'
        )}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => navigate('/ownership')}
            title="View Owner"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="View Distributions"
          >
            <FileText className="h-3.5 w-3.5" />
          </Button>
          {showActions && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              title="Edit Stake"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
