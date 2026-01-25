import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Link } from 'react-router-dom';
import { ExternalLink, FileWarning, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { PropertyWithFinancials } from '@/hooks/useProperties';
import { formatGBP, getExpiryStatus, daysUntil } from '@/lib/calculations';

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

  // Missing insurance (would need insurance table - simplified for now)
  const hasMissingInsurance = false; // TODO: Check insurance_policies table

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

export function PropertyMap({ 
  properties, 
  filters,
  onPropertyClick,
  className = 'h-[600px]',
}: PropertyMapProps) {
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
    <div className={className}>
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
                  <Card className="border-0 shadow-none bg-transparent p-0 min-w-[280px]">
                    <div className="space-y-3">
                      {/* Address */}
                      <div>
                        <h3 className="font-semibold text-foreground line-clamp-2">
                          {property.address_line}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {property.postcode}
                        </p>
                      </div>

                      {/* Quick Stats */}
                      <div className="flex gap-4 text-sm">
                        {property.current_value_gbp && (
                          <div>
                            <span className="text-muted-foreground">Value:</span>{' '}
                            <span className="font-medium">{formatGBP(Number(property.current_value_gbp))}</span>
                          </div>
                        )}
                        {income?.annual_rent_gbp && (
                          <div>
                            <span className="text-muted-foreground">Rent:</span>{' '}
                            <span className="font-medium">{formatGBP(Number(income.annual_rent_gbp))}/yr</span>
                          </div>
                        )}
                      </div>

                      {/* Flags */}
                      <div className="flex flex-wrap gap-1">
                        {flags.hasMissingFinance && (
                          <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 text-xs">
                            <FileWarning className="h-3 w-3 mr-1" />
                            Missing Finance
                          </Badge>
                        )}
                        {flags.hasRenewalSoon && (
                          <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 text-xs">
                            <Calendar className="h-3 w-3 mr-1" />
                            Renewal in {flags.renewalDays}d
                          </Badge>
                        )}
                        {flags.hasNegativeCashflow && (
                          <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">
                            <TrendingDown className="h-3 w-3 mr-1" />
                            Negative CF
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2 border-t border-border">
                        <Button asChild size="sm" className="flex-1">
                          <Link to={`/properties/${property.id}`}>
                            <ExternalLink className="h-3 w-3 mr-1" />
                            View
                          </Link>
                        </Button>
                        <Button asChild variant="outline" size="sm" className="flex-1">
                          <Link to="/missing-info">
                            Missing Info
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </Card>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}
