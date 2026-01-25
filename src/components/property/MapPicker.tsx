import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, Loader2, Navigation, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLat?: number | null;
  initialLng?: number | null;
  address?: string;
  onSave: (lat: number, lng: number) => Promise<void>;
}

interface DraggableMarkerProps {
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
}

function DraggableMarker({ position, onPositionChange }: DraggableMarkerProps) {
  const [markerPosition, setMarkerPosition] = useState<[number, number]>(position);

  useEffect(() => {
    setMarkerPosition(position);
  }, [position]);

  const eventHandlers = useMemo(
    () => ({
      dragend(e: L.DragEndEvent) {
        const marker = e.target;
        const pos = marker.getLatLng();
        setMarkerPosition([pos.lat, pos.lng]);
        onPositionChange(pos.lat, pos.lng);
      },
    }),
    [onPositionChange]
  );

  return (
    <Marker
      position={markerPosition}
      draggable={true}
      eventHandlers={eventHandlers}
    />
  );
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [map, center, zoom]);
  
  return null;
}

export function MapPicker({
  open,
  onOpenChange,
  initialLat,
  initialLng,
  address,
  onSave,
}: MapPickerProps) {
  const { toast } = useToast();
  const [lat, setLat] = useState<number>(initialLat ?? 51.5074);
  const [lng, setLng] = useState<number>(initialLng ?? -0.1278);
  const [mapCenter, setMapCenter] = useState<[number, number]>([lat, lng]);
  const [mapZoom, setMapZoom] = useState(initialLat && initialLng ? 15 : 6);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      const newLat = initialLat ?? 51.5074;
      const newLng = initialLng ?? -0.1278;
      setLat(newLat);
      setLng(newLng);
      setMapCenter([newLat, newLng]);
      setMapZoom(initialLat && initialLng ? 15 : 6);
      setSearchQuery('');
    }
  }, [open, initialLat, initialLng]);

  const handlePositionChange = useCallback((newLat: number, newLng: number) => {
    setLat(Number(newLat.toFixed(8)));
    setLng(Number(newLng.toFixed(8)));
  }, []);

  const handleMapClick = useCallback((newLat: number, newLng: number) => {
    setLat(Number(newLat.toFixed(8)));
    setLng(Number(newLng.toFixed(8)));
    setMapCenter([newLat, newLng]);
  }, []);

  const geocodeAddress = async (searchAddress: string) => {
    if (!searchAddress.trim()) return;
    
    setIsGeocoding(true);
    try {
      // Using Nominatim (OpenStreetMap's geocoding service)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&countrycodes=gb`,
        {
          headers: {
            'Accept': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error('Geocoding failed');
      
      const results = await response.json();
      
      if (results.length > 0) {
        const result = results[0];
        const newLat = parseFloat(result.lat);
        const newLng = parseFloat(result.lon);
        setLat(Number(newLat.toFixed(8)));
        setLng(Number(newLng.toFixed(8)));
        setMapCenter([newLat, newLng]);
        setMapZoom(17);
        toast({
          title: 'Location found',
          description: result.display_name.substring(0, 60) + '...',
        });
      } else {
        toast({
          title: 'Location not found',
          description: 'Try a more specific address or set the pin manually.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Geocoding error',
        description: 'Failed to search for address. Please set the pin manually.',
        variant: 'destructive',
      });
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleGeocodeFromPropertyAddress = () => {
    if (address) {
      setSearchQuery(address);
      geocodeAddress(address);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    geocodeAddress(searchQuery);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(lat, lng);
      onOpenChange(false);
      toast({
        title: 'Coordinates saved',
        description: `Location set to ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save coordinates.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= -90 && value <= 90) {
      setLat(value);
      setMapCenter([value, lng]);
    }
  };

  const handleLngChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= -180 && value <= 180) {
      setLng(value);
      setMapCenter([lat, value]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Set Property Coordinates
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search for an address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                disabled={isGeocoding}
              />
            </div>
            <Button type="submit" variant="outline" disabled={isGeocoding || !searchQuery.trim()}>
              {isGeocoding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
            {address && (
              <Button
                type="button"
                variant="outline"
                onClick={handleGeocodeFromPropertyAddress}
                disabled={isGeocoding}
                title="Use property address"
              >
                <Navigation className="h-4 w-4" />
              </Button>
            )}
          </form>

          {/* Map container */}
          <div className="h-[350px] rounded-lg overflow-hidden border border-border">
            <MapContainer
              center={mapCenter}
              zoom={mapZoom}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <MapController center={mapCenter} zoom={mapZoom} />
              <MapClickHandler onMapClick={handleMapClick} />
              <DraggableMarker
                position={[lat, lng]}
                onPositionChange={handlePositionChange}
              />
            </MapContainer>
          </div>

          <p className="text-sm text-muted-foreground">
            Click on the map or drag the marker to set the exact location.
          </p>

          {/* Coordinate inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="latitude">Latitude</Label>
              <Input
                id="latitude"
                type="number"
                step="0.00000001"
                min="-90"
                max="90"
                value={lat}
                onChange={handleLatChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="longitude">Longitude</Label>
              <Input
                id="longitude"
                type="number"
                step="0.00000001"
                min="-180"
                max="180"
                value={lng}
                onChange={handleLngChange}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Coordinates'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
