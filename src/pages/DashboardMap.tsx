import React, { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, MapPin, ExternalLink, Route } from 'lucide-react';
import { useProperties } from '@/hooks/useProperties';
import { PropertyMap } from '@/components/maps/PropertyMap';
import { useDuplicateDetection } from '@/hooks/useDuplicateDetection';
import { Link } from 'react-router-dom';
import { MissingLocationsBanner } from '@/components/geocoding';

export default function DashboardMap() {
  const { data: properties, isLoading } = useProperties();
  const duplicates = useDuplicateDetection(properties);
  
  // Count properties missing location
  const missingLocationCount = useMemo(() => {
    if (!properties) return 0;
    return properties.filter(p => !p.latitude || !p.longitude).length;
  }, [properties]);
  
  const [search, setSearch] = useState('');
  const [missingType, setMissingType] = useState<'all' | 'finance' | 'insurance'>('all');
  const [renewalDays, setRenewalDays] = useState<30 | 60 | 90 | undefined>();
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedLender, setSelectedLender] = useState<string>('');
  const [selectedProperties, setSelectedProperties] = useState<string[]>([]);

  // Extract unique cities and lenders for filters
  const filterOptions = useMemo(() => {
    if (!properties) return { cities: [], lenders: [] };
    
    const cities = [...new Set(
      properties
        .map(p => p.area_name || p.town_city)
        .filter(Boolean)
    )].sort() as string[];
    
    const lenders = [...new Set(
      properties
        .map(p => p.loans?.[0]?.lender)
        .filter(Boolean)
    )].sort() as string[];
    
    return { cities, lenders };
  }, [properties]);

  // Properties with coordinates
  const propertiesWithCoords = useMemo(() => {
    return properties?.filter(p => p.latitude && p.longitude) || [];
  }, [properties]);

  // Plan route handler - opens Google Maps with directions
  const handlePlanRoute = () => {
    if (selectedProperties.length < 2) return;
    
    const waypoints = selectedProperties
      .map(id => properties?.find(p => p.id === id))
      .filter(p => p?.latitude && p?.longitude)
      .map(p => `${p!.latitude},${p!.longitude}`);
    
    if (waypoints.length < 2) return;
    
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const waypointsParam = waypoints.slice(1, -1).join('|');
    
    const url = `https://www.google.com/maps/dir/${origin}/${waypointsParam ? `${waypointsParam}/` : ''}${destination}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-[600px]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Missing Locations Banner */}
        <MissingLocationsBanner 
          missingCount={missingLocationCount} 
          totalCount={properties?.length || 0} 
        />

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Portfolio Map</h1>
            <p className="text-muted-foreground">
              {propertiesWithCoords.length} of {properties?.length || 0} properties with location data
            </p>
          </div>
          
          {selectedProperties.length >= 2 && (
            <Button onClick={handlePlanRoute} variant="outline">
              <Route className="h-4 w-4 mr-2" />
              Plan Route ({selectedProperties.length} properties)
            </Button>
          )}
        </div>

        {/* Filters */}
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by address, postcode..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 bg-input"
                />
              </div>

              {/* City Filter */}
              <Select value={selectedCity || '__all__'} onValueChange={(v) => setSelectedCity(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[180px] bg-input">
                  <SelectValue placeholder="All Areas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Areas</SelectItem>
                  {filterOptions.cities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Lender Filter */}
              <Select value={selectedLender || '__all__'} onValueChange={(v) => setSelectedLender(v === '__all__' ? '' : v)}>
                <SelectTrigger className="w-[180px] bg-input">
                  <SelectValue placeholder="All Lenders" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Lenders</SelectItem>
                  {filterOptions.lenders.map(lender => (
                    <SelectItem key={lender} value={lender}>{lender}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Renewal Days Filter */}
              <Select 
                value={renewalDays?.toString() || '__any__'} 
                onValueChange={(v) => setRenewalDays(v === '__any__' ? undefined : Number(v) as 30 | 60 | 90)}
              >
                <SelectTrigger className="w-[180px] bg-input">
                  <SelectValue placeholder="Renewal Soon" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__any__">Any Renewal</SelectItem>
                  <SelectItem value="30">Within 30 days</SelectItem>
                  <SelectItem value="60">Within 60 days</SelectItem>
                  <SelectItem value="90">Within 90 days</SelectItem>
                </SelectContent>
              </Select>

              {/* Missing Type Filter */}
              <Select 
                value={missingType} 
                onValueChange={(v) => setMissingType(v as 'all' | 'finance' | 'insurance')}
              >
                <SelectTrigger className="w-[180px] bg-input">
                  <SelectValue placeholder="Missing Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Properties</SelectItem>
                  <SelectItem value="finance">Missing Finance</SelectItem>
                  <SelectItem value="insurance">Missing Insurance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Duplicate Detection Warning */}
        {duplicates.length > 0 && (
          <Card className="bg-[hsl(var(--warning))]/10 border-[hsl(var(--warning))]/30">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-[hsl(var(--warning))]">
                <Filter className="h-4 w-4" />
                Possible Duplicates Detected ({duplicates.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="space-y-2">
                {duplicates.slice(0, 3).map((dup, i) => (
                  <div key={i} className="flex items-center gap-4 text-sm">
                    <Badge variant="outline" className="text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30">
                      {dup.confidence === 'high' ? 'High' : 'Medium'}
                    </Badge>
                    <span className="truncate flex-1">
                      {dup.property1.address_line}
                    </span>
                    <span className="text-muted-foreground">↔</span>
                    <span className="truncate flex-1">
                      {dup.property2.address_line}
                    </span>
                    <Link 
                      to={`/properties/${dup.property1.id}`}
                      className="text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                ))}
                {duplicates.length > 3 && (
                  <p className="text-xs text-muted-foreground">
                    +{duplicates.length - 3} more potential duplicates
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Map */}
        <Card className="bg-card border-border">
          <CardContent className="p-0">
            <PropertyMap
              properties={properties || []}
              filters={{
                search,
                city: selectedCity || undefined,
                lender: selectedLender || undefined,
                renewalDays,
                missingType: missingType === 'all' ? undefined : missingType,
              }}
              className="h-[600px] rounded-lg"
            />
          </CardContent>
        </Card>

        {/* Properties without coordinates */}
        {properties && properties.length > propertiesWithCoords.length && (
          <Card className="bg-muted/30 border-border">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {properties.length - propertiesWithCoords.length} properties without location data
              </CardTitle>
            </CardHeader>
            <CardContent className="py-0 pb-3">
              <div className="flex flex-wrap gap-2">
                {properties
                  .filter(p => !p.latitude || !p.longitude)
                  .slice(0, 5)
                  .map(p => (
                    <Link
                      key={p.id}
                      to={`/properties/${p.id}/edit`}
                      className="text-sm text-primary hover:underline"
                    >
                      {p.address_line}
                    </Link>
                  ))}
                {properties.length - propertiesWithCoords.length > 5 && (
                  <span className="text-sm text-muted-foreground">
                    +{properties.length - propertiesWithCoords.length - 5} more
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
