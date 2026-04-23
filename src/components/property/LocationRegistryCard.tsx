import React, { useState } from 'react';
import { MapPin, Navigation, Loader2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

// Fix Leaflet default marker icon
const iconDefaultPrototype = L.Icon.Default.prototype as typeof L.Icon.Default.prototype & {
  _getIconUrl?: unknown;
};
delete iconDefaultPrototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icon
const propertyIcon = L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background-color: hsl(174, 72%, 45%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

interface LocationRegistryCardProps {
  propertyId: string;
  latitude?: number | null;
  longitude?: number | null;
  titleNumber?: string | null;
  tenure?: string | null;
  leaseYearsRemaining?: number | null;
  uprn?: string | null;
  landRegistryLink?: string | null;
  address?: string;
}

// Component to update map center when coordinates change
function MapUpdater({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  React.useEffect(() => {
    map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
}

export function LocationRegistryCard({
  propertyId,
  latitude,
  longitude,
  titleNumber,
  tenure,
  leaseYearsRemaining,
  uprn,
  landRegistryLink,
  address,
}: LocationRegistryCardProps) {
  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Coordinate edit state
  const [coordLat, setCoordLat] = useState<string>('');
  const [coordLng, setCoordLng] = useState<string>('');

  const hasCoordinates = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  const openCoordDialog = () => {
    setCoordLat(latitude?.toString() || '');
    setCoordLng(longitude?.toString() || '');
    setCoordDialogOpen(true);
  };

  const handleSaveCoordinates = async () => {
    const lat = parseFloat(coordLat);
    const lng = parseFloat(coordLng);
    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast({
        title: 'Invalid coordinates',
        description: 'Please enter valid latitude (-90 to 90) and longitude (-180 to 180).',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from('properties_v2')
        .update({ latitude: lat, longitude: lng })
        .eq('id', propertyId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['property_v2', propertyId] });
      setCoordDialogOpen(false);
      toast({
        title: 'Coordinates saved',
        description: `Location set to ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to save coordinates.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const geocodeFromAddress = async () => {
    if (!address) return;
    
    setIsGeocoding(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=gb`,
        { headers: { 'Accept': 'application/json' } }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const results = await response.json();
      
      if (results.length > 0) {
        const result = results[0];
        setCoordLat(parseFloat(result.lat).toFixed(8));
        setCoordLng(parseFloat(result.lon).toFixed(8));
        toast({
          title: 'Location found',
          description: result.display_name.substring(0, 60) + '...',
        });
      } else {
        toast({
          title: 'Location not found',
          description: 'Try entering coordinates manually.',
          variant: 'destructive',
        });
      }
    } catch (_error) {
      toast({
        title: 'Geocoding error',
        description: 'Failed to search for address.',
        variant: 'destructive',
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const openInGoogleMaps = () => {
    if (hasCoordinates) {
      window.open(`https://www.google.com/maps?q=${latitude},${longitude}`, '_blank');
    }
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location
          </CardTitle>
          {hasCoordinates && (
            <Button variant="ghost" size="sm" onClick={openInGoogleMaps}>
              <ExternalLink className="h-4 w-4 mr-1" />
              Open in Maps
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {hasCoordinates ? (
            <>
              {/* Interactive Map */}
              <div className="h-[250px] rounded-lg overflow-hidden border border-border">
                <MapContainer
                  center={[Number(latitude), Number(longitude)]}
                  zoom={15}
                  className="h-full w-full"
                  style={{ background: 'hsl(222 47% 8%)' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  />
                  <Marker 
                    position={[Number(latitude), Number(longitude)]} 
                    icon={propertyIcon}
                  />
                  <MapUpdater lat={Number(latitude)} lng={Number(longitude)} />
                </MapContainer>
              </div>
              
              {/* Coordinate display */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                </span>
                <Button variant="outline" size="sm" onClick={openCoordDialog}>
                  Update Location
                </Button>
              </div>
            </>
          ) : (
            <div className="h-[200px] rounded-lg bg-muted/30 border border-dashed border-border flex flex-col items-center justify-center text-center p-4">
              <MapPin className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground mb-3">No location set for this property</p>
              <Button onClick={openCoordDialog}>
                <MapPin className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Coordinates Dialog */}
      <Dialog open={coordDialogOpen} onOpenChange={setCoordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Set Location
            </DialogTitle>
            <DialogDescription>
              Adjust the exact latitude/longitude of this property by dragging the pin or searching.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {address && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Property address:</p>
                <div className="flex gap-2">
                  <p className="text-sm flex-1 bg-muted p-2 rounded">{address}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={geocodeFromAddress}
                    disabled={isGeocoding}
                    title="Lookup coordinates from address"
                  >
                    {isGeocoding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Navigation className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="coord_lat">Latitude</Label>
                <Input
                  id="coord_lat"
                  type="number"
                  step="0.00000001"
                  min="-90"
                  max="90"
                  value={coordLat}
                  onChange={(e) => setCoordLat(e.target.value)}
                  placeholder="e.g. 51.5074"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="coord_lng">Longitude</Label>
                <Input
                  id="coord_lng"
                  type="number"
                  step="0.00000001"
                  min="-180"
                  max="180"
                  value={coordLng}
                  onChange={(e) => setCoordLng(e.target.value)}
                  placeholder="e.g. -0.1278"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Tip: You can find coordinates on Google Maps by right-clicking a location and selecting the coordinates.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCoordDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveCoordinates} disabled={isSaving || !coordLat || !coordLng}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Location'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
