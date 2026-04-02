import { useState } from 'react';
import {
  ArrowLeft,
  Edit,
  Flame,
  Landmark,
  Home,
  Building2,
  Store,
  MoreVertical,
  Archive,
  Trash2,
  Share2,
  Bed,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PROPERTY_TYPES, LIFECYCLE_STAGES, LISTING_GRADES } from '@/hooks/usePropertiesV2';
import { TEXT } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface PropertyHeaderProps {
  property: {
    id: string;
    address_line_1: string;
    address_line_2?: string | null;
    city: string;
    postcode: string;
    property_type: string;
    lifecycle_stage: string;
    listing_grade: string;
    has_gas_supply: boolean | null;
    total_lettable_rooms: number | null;
    entity_name: string;
    entity_type: string;
    current_valuation: number | null;
    purchase_price: number | null;
    whole_house_rent_pcm: number | null;
  };
  coverPhoto: string | null;
  monthlyRent: number | null;
  currentLtv: number | null;
  grossYield: number | null;
  onEdit: () => void;
  onDelete?: () => void;
  onArchive?: () => void;
}

const PROPERTY_TYPE_BG: Record<string, string> = {
  hmo_licensed: 'bg-indigo-100 text-indigo-700',
  hmo_mandatory: 'bg-indigo-100 text-indigo-700',
  single_let: 'bg-teal-100 text-teal-700',
  multi_unit_freehold: 'bg-cyan-100 text-cyan-700',
  commercial: 'bg-slate-100 text-slate-700',
  mixed_use: 'bg-slate-100 text-slate-700',
};

const LIFECYCLE_BG: Record<string, string> = {
  pipeline: 'bg-blue-100 text-blue-700',
  acquisition: 'bg-sky-100 text-sky-700',
  refurbishment: 'bg-orange-100 text-orange-700',
  letting: 'bg-purple-100 text-purple-700',
  stabilised: 'bg-emerald-100 text-emerald-700',
  disposal: 'bg-red-100 text-red-700',
};

const PROPERTY_TYPE_ICONS: Record<string, React.ElementType> = {
  hmo_licensed: Building2,
  hmo_mandatory: Building2,
  single_let: Home,
  multi_unit_freehold: Building2,
  commercial: Store,
  mixed_use: Store,
};

function getLabel(arr: readonly { value: string; label: string }[], v: string) {
  return arr.find(x => x.value === v)?.label || v;
}

function fmtGBP(v: number | null) {
  if (v == null) return '—';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 0 }).format(v);
}

function fmtPct(v: number | null) {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

export function PropertyHeader({
  property,
  coverPhoto,
  monthlyRent,
  currentLtv,
  grossYield,
  onEdit,
  onDelete,
  onArchive,
}: PropertyHeaderProps) {
  const navigate = useNavigate();
  const TypeIcon = PROPERTY_TYPE_ICONS[property.property_type] || Home;

  return (
    <div className="space-y-4">
      {/* Back button */}
      <Button variant="ghost" size="sm" onClick={() => navigate('/properties-v2')} className="mb-1">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back to Properties
      </Button>

      <div className="flex gap-6">
        {/* Property image or placeholder */}
        <div className="hidden md:flex h-32 w-48 flex-shrink-0 rounded-lg overflow-hidden border border-border bg-muted items-center justify-center">
          {coverPhoto ? (
            <img src={coverPhoto} alt={property.address_line_1} className="w-full h-full object-cover" />
          ) : (
            <TypeIcon className="h-12 w-12 text-muted-foreground/40" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className={cn(TEXT.pageTitle, 'truncate')}>
                {property.address_line_1}{property.address_line_2 ? `, ${property.address_line_2}` : ''}
              </h1>
              <p className="text-muted-foreground">{property.city}, {property.postcode}</p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-1" /> Edit
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigator.clipboard.writeText(window.location.href)}>
                    <Share2 className="h-4 w-4 mr-2" /> Copy link
                  </DropdownMenuItem>
                  {onArchive && (
                    <DropdownMenuItem onClick={onArchive}>
                      <Archive className="h-4 w-4 mr-2" /> Archive
                    </DropdownMenuItem>
                  )}
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={onDelete} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={PROPERTY_TYPE_BG[property.property_type]}>
              {getLabel(PROPERTY_TYPES, property.property_type)}
            </Badge>
            {property.total_lettable_rooms != null && property.total_lettable_rooms > 0 && (
              <Badge variant="secondary">
                <Bed className="h-3 w-3 mr-1" /> {property.total_lettable_rooms} beds
              </Badge>
            )}
            <Badge className={LIFECYCLE_BG[property.lifecycle_stage]}>
              {getLabel(LIFECYCLE_STAGES, property.lifecycle_stage)}
            </Badge>
            {property.listing_grade !== 'none' && (
              <Badge className="bg-amber-100 text-amber-800">
                <Landmark className="h-3 w-3 mr-1" />{getLabel(LISTING_GRADES, property.listing_grade)} Listed
              </Badge>
            )}
            {property.has_gas_supply === false && (
              <Badge variant="secondary" className="text-muted-foreground">
                <Flame className="h-3 w-3 mr-1" /> No Gas
              </Badge>
            )}
          </div>

          {/* Quick stats */}
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <QuickStat label="Value" value={fmtGBP(property.current_valuation)} />
            <QuickStat label="Monthly rent" value={fmtGBP(monthlyRent)} />
            <QuickStat label="LTV" value={fmtPct(currentLtv)} />
            <QuickStat label="Gross yield" value={fmtPct(grossYield)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
