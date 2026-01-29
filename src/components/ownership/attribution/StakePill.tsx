import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Building2, User, Users, Share2 } from 'lucide-react';
import { formatPercent } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface StakePillProps {
  percent: number;
  ownerType: string;
  pathDescription: string;
  ownerId?: string;
  className?: string;
}

const ownerTypeIcons: Record<string, React.ReactNode> = {
  INDIVIDUAL: <User className="h-3 w-3" />,
  COMPANY: <Building2 className="h-3 w-3" />,
  TRUST: <Users className="h-3 w-3" />,
  SPV: <Building2 className="h-3 w-3" />,
  Person: <User className="h-3 w-3" />,
};

export function StakePill({ percent, ownerType, pathDescription, ownerId, className }: StakePillProps) {
  const navigate = useNavigate();

  const handleNavigate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (ownerId) {
      navigate('/ownership');
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
            'font-mono transition-all duration-150',
            'hover:bg-primary/10 hover:border-primary/50 hover:scale-105',
            'active:scale-95 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
            'text-foreground border-border',
            className
          )}
        >
          {formatPercent(percent, 1)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded bg-muted">
              {ownerTypeIcons[ownerType] || <User className="h-3 w-3" />}
            </div>
            <div>
              <p className="text-sm font-medium">{ownerType}</p>
              <p className="text-xs text-muted-foreground">Ownership Type</p>
            </div>
          </div>
          
          <div className="border-t border-border/50 pt-2">
            <div className="flex items-start gap-2">
              <Share2 className="h-3.5 w-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Ownership Path</p>
                <p className="text-sm">{pathDescription}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground border-t border-border/50">
            <button 
              onClick={handleNavigate}
              className="hover:text-foreground hover:underline"
            >
              View ownership structure →
            </button>
            <span className="font-mono font-semibold text-foreground">{formatPercent(percent, 2)}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
