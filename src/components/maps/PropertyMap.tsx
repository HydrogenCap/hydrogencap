import React, { useMemo, forwardRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { ExternalLink, FileWarning, TrendingDown, Calendar, Bed, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import { formatGBP, formatPercent, getExpiryStatus, daysUntil, calculateLTV, calculateMonthlyCashflowAfterDebt, getEffectiveCosts } from '@/lib/calculations';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons
const createCustomIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
};

const icons = {
  normal: createCustomIcon('hsl(174, 72%, 45%)'),
  warning: createCustomIcon('hsl(38, 92%, 50%)'),
  critical: createCustomIcon('hsl(0, 72%, 51%)'),
};

interface PropertyFlags {
  hasMissingFinance: boolean;
  hasMissingInsurance: boolean;
  hasRenewalSoon: boolean;
  renewalDays?: number;
  hasNegativeCashflow: boolean;
}

function getPropertyFlags(property: PropertyWithFinancials): PropertyFlags {
  const currentYear = new Date().getFullYear();
  const loan = property.loans?.[0];
  const income = property.income?.find(i => i.year === currentYear);

  // Missing finance
  const hasMissingFinance = !property.current_value_gbp || 
    (loan && !loan.current_mortgage_balance_gbp);

  // Insurance check not yet implemented
  const hasMissingInsurance = false;

  // Renewal soon (fixed rate expiry)
  let hasRenewalSoon = false;
  let renewalDays: number | undefined;
  if (loan?.fixed_rate_expires) {
    const days = daysUntil(loan.fixed_rate_expires);
    const status = getExpiryStatus(loan.fixed_rate_expires);
    if (status === 'warning' || status === 'critical' || status === 'expired') {
      hasRenewalSoon = true;
      renewalDays = days;
    }
  }

  // Negative cashflow (simplified)
  const hasNegativeCashflow = income && loan?.mortgage_payment_gbp 
    ? (Number(income.annual_rent_gbp) / 12) < Number(loan.mortgage_payment_gbp)
    : false;

  return {
    hasMissingFinance,
    hasMissingInsurance,
    hasRenewalSoon,
    renewalDays,
    hasNegativeCashflow,
  };
}

function getMarkerIcon(flags: PropertyFlags) {
  if (flags.hasNegativeCashflow) return icons.critical;
  if (flags.hasRenewalSoon && flags.renewalDays !== undefined && flags.renewalDays <= 30) return icons.critical;
  if (flags.hasMissingFinance || flags.hasRenewalSoon) return icons.warning;
  return icons.normal;
}

interface PropertyMapProps {
  properties: PropertyWithFinancials[];
  filters?: {
    missingType?: 'all' | 'finance' | 'insurance';
    renewalDays?: 30 | 60 | 90;
    city?: string;
    postcodeDistrict?: string;
    lender?: string;
    search?: string;
  };
  onPropertyClick?: (property: PropertyWithFinancials) => void;
  className?: string;
}

function MapBoundsUpdater({ properties }: { properties: PropertyWithFinancials[] }) {
  const map = useMap();

  useMemo(() => {
    const validProperties = properties.filter(p => p.latitude && p.longitude);
    if (validProperties.length === 0) return;

    const bounds = L.latLngBounds(
      validProperties.map(p => [Number(p.latitude), Number(p.longitude)] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [properties, map]);

  return null;
}

export const PropertyMap = forwardRef<HTMLDivElement, PropertyMapProps>(function PropertyMap({ 
  properties, 
  filters,
  onPropertyClick,
  className = 'h-[600px]',
}, ref) {
  // Apply filters
  const filteredProperties = useMemo(() => {
    let result = properties.filter(p => p.latitude && p.longitude);

    if (filters?.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(p => 
        p.address_line.toLowerCase().includes(search) ||
        p.postcode?.toLowerCase().includes(search) ||
        p.area_name?.toLowerCase().includes(search)
      );
    }

    if (filters?.city) {
      result = result.filter(p => 
        p.area_name?.toLowerCase().includes(filters.city!.toLowerCase()) ||
        p.town_city?.toLowerCase().includes(filters.city!.toLowerCase())
      );
    }

    if (filters?.postcodeDistrict) {
      result = result.filter(p => 
        p.postcode?.toUpperCase().startsWith(filters.postcodeDistrict!.toUpperCase())
      );
    }

    if (filters?.lender) {
      result = result.filter(p => {
        const loan = p.loans?.[0];
        return loan?.lender?.toLowerCase().includes(filters.lender!.toLowerCase());
      });
    }

    if (filters?.missingType === 'finance') {
      result = result.filter(p => {
        const flags = getPropertyFlags(p);
        return flags.hasMissingFinance;
      });
    }

    if (filters?.renewalDays) {
      result = result.filter(p => {
        const loan = p.loans?.[0];
        if (!loan?.fixed_rate_expires) return false;
        const days = daysUntil(loan.fixed_rate_expires);
        return days <= filters.renewalDays! && days >= 0;
      });
    }

    return result;
  }, [properties, filters]);

  // UK center
  const defaultCenter: [number, number] = [52.3555, -1.1743];

  if (filteredProperties.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-muted/20 rounded-lg border border-border`}>
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium">No properties with location data</p>
          <p className="text-sm">Add addresses to your properties to see them on the map</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} className={className}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        className="h-full w-full rounded-lg"
        style={{ background: 'hsl(222 47% 8%)' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        <MapBoundsUpdater properties={filteredProperties} />
        
        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom
          showCoverageOnHover={false}
          maxClusterRadius={40}
          iconCreateFunction={(cluster) => {
            const count = cluster.getChildCount();
            return L.divIcon({
              html: `<div style="
                background: hsl(174, 72%, 45%);
                color: white;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                font-size: 14px;
                border: 3px solid white;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">${count}</div>`,
              className: 'marker-cluster',
              iconSize: L.point(36, 36),
            });
          }}
        >
          {filteredProperties.map((property) => {
            const flags = getPropertyFlags(property);
            const icon = getMarkerIcon(flags);
            const currentYear = new Date().getFullYear();
            const income = property.income?.find(i => i.year === currentYear);

            return (
              <Marker
                key={property.id}
                position={[Number(property.latitude), Number(property.longitude)]}
                icon={icon}
              >
                <Popup className="property-popup">
                  {/* High-contrast card with solid background */}
                  <div 
                    className="min-w-[300px] rounded-lg shadow-xl border"
                    style={{ 
                      backgroundColor: '#1a1f2e',
                      borderColor: 'rgba(255,255,255,0.1)',
                    }}
                  >
                    <div className="p-4 space-y-3">
                      {/* Address - Bold and readable */}
                      <div>
                        <h3 
                          className="font-bold text-base leading-tight line-clamp-2"
                          style={{ color: '#f9fafb' }}
                        >
                          {property.address_line}
                        </h3>
                        <p 
                          className="text-sm mt-0.5"
                          style={{ color: '#9ca3af' }}
                        >
                          {[property.area_name, property.postcode].filter(Boolean).join(' • ')}
                        </p>
                      </div>

                      {/* Key Stats Grid */}
                      <div 
                        className="grid grid-cols-2 gap-2 py-2 px-3 rounded-md"
                        style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
                      >
                        {/* Beds */}
                        {property.beds !== null && property.beds !== undefined && (
                          <div className="flex items-center gap-1.5">
                            <Bed className="h-3.5 w-3.5" style={{ color: '#6b7280' }} />
                            <span className="text-sm" style={{ color: '#d1d5db' }}>
                              <span className="font-semibold" style={{ color: '#f9fafb' }}>{property.beds}</span> beds
                            </span>
                          </div>
                        )}
                        
                        {/* Value */}
                        {property.current_value_gbp && (
                          <div>
                            <span className="text-xs" style={{ color: '#6b7280' }}>Value</span>
                            <p className="text-sm font-semibold" style={{ color: '#f9fafb' }}>
                              {formatGBP(Number(property.current_value_gbp))}
                            </p>
                          </div>
                        )}
                        
                        {/* LTV */}
                        {(() => {
                          const loan = property.loans?.[0];
                          const ltv = calculateLTV(
                            loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null,
                            property.current_value_gbp ? Number(property.current_value_gbp) : null
                          );
                          if (ltv === null) return null;
                          return (
                            <div>
                              <span className="text-xs" style={{ color: '#6b7280' }}>LTV</span>
                              <p className="text-sm font-semibold" style={{ color: ltv > 75 ? '#f87171' : '#f9fafb' }}>
                                {formatPercent(ltv, 0)}
                              </p>
                            </div>
                          );
                        })()}
                        
                        {/* Net Cashflow */}
                        {(() => {
                          const loan = property.loans?.[0];
                          const costs = property.costs?.find(c => c.year === currentYear);
                          const effectiveCosts = getEffectiveCosts(
                            income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null,
                            property.current_value_gbp ? Number(property.current_value_gbp) : null,
                            costs
                          );
                          const monthlyCashflow = calculateMonthlyCashflowAfterDebt(
                            income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null,
                            effectiveCosts.total,
                            loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null
                          );
                          if (monthlyCashflow === null) return null;
                          return (
                            <div>
                              <span className="text-xs" style={{ color: '#6b7280' }}>Net CF/mo</span>
                              <p 
                                className="text-sm font-semibold" 
                                style={{ color: monthlyCashflow < 0 ? '#f87171' : '#4ade80' }}
                              >
                                {formatGBP(monthlyCashflow)}
                              </p>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Status Flags */}
                      {(flags.hasMissingFinance || flags.hasRenewalSoon || flags.hasNegativeCashflow) && (
                        <div className="flex flex-wrap gap-1.5">
                          {flags.hasMissingFinance && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}
                            >
                              <FileWarning className="h-3 w-3" />
                              Missing Finance
                            </span>
                          )}
                          {flags.hasRenewalSoon && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: 'rgba(251, 191, 36, 0.15)', color: '#fbbf24' }}
                            >
                              <Calendar className="h-3 w-3" />
                              Renewal {flags.renewalDays}d
                            </span>
                          )}
                          {flags.hasNegativeCashflow && (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
                              style={{ backgroundColor: 'rgba(248, 113, 113, 0.15)', color: '#f87171' }}
                            >
                              <TrendingDown className="h-3 w-3" />
                              Negative CF
                            </span>
                          )}
                        </div>
                      )}

                      {/* CTA Button */}
                      <Link 
                        to={`/properties/${property.id}`}
                        className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-md text-sm font-semibold transition-colors"
                        style={{ 
                          backgroundColor: 'hsl(174, 72%, 45%)',
                          color: '#111827',
                        }}
                      >
                        <Home className="h-4 w-4" />
                        View Property
                      </Link>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
});
