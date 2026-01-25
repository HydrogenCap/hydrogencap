import React, { useState } from 'react';
import { MapPin, ExternalLink, Edit2, Check, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MapPicker } from './MapPicker';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
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
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Edit form state
  const [editValues, setEditValues] = useState({
    title_number: titleNumber || '',
    tenure: tenure || '',
    lease_years_remaining: leaseYearsRemaining?.toString() || '',
    uprn: uprn || '',
    land_registry_link: landRegistryLink || '',
  });

  const hasCoordinates = latitude !== null && latitude !== undefined && longitude !== null && longitude !== undefined;

  const handleSaveCoordinates = async (lat: number, lng: number) => {
    const { error } = await supabase
      .from('properties')
      .update({ latitude: lat, longitude: lng })
      .eq('id', propertyId);

    if (error) throw error;
    
    queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
  };

  const handleStartEdit = () => {
    setEditValues({
      title_number: titleNumber || '',
      tenure: tenure || '',
      lease_years_remaining: leaseYearsRemaining?.toString() || '',
      uprn: uprn || '',
      land_registry_link: landRegistryLink || '',
    });
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSaveRegistry = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('properties')
        .update({
          title_number: editValues.title_number || null,
          tenure: editValues.tenure || null,
          lease_years_remaining: editValues.lease_years_remaining ? parseInt(editValues.lease_years_remaining) : null,
          uprn: editValues.uprn || null,
          land_registry_link: editValues.land_registry_link || null,
        })
        .eq('id', propertyId);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      setIsEditing(false);
      toast({
        title: 'Registry details saved',
        description: 'Land registry information has been updated.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save registry details.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <Card className="bg-card border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location & Registry
          </CardTitle>
          {!isEditing ? (
            <Button variant="ghost" size="sm" onClick={handleStartEdit}>
              <Edit2 className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleSaveRegistry} disabled={isSaving}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Map preview or add button */}
          <div>
            <Label className="text-muted-foreground text-sm">Coordinates</Label>
            {hasCoordinates ? (
              <div className="mt-2 space-y-2">
                <div className="h-[150px] rounded-lg overflow-hidden border border-border">
                  <MapContainer
                    center={[latitude!, longitude!]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    className="z-0"
                    scrollWheelZoom={false}
                    dragging={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={[latitude!, longitude!]} />
                  </MapContainer>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setMapPickerOpen(true)}>
                    Update
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={() => setMapPickerOpen(true)}
              >
                <MapPin className="h-4 w-4 mr-2" />
                Add Coordinates
              </Button>
            )}
          </div>

          {/* Registry Details */}
          {isEditing ? (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="space-y-2">
                <Label htmlFor="title_number">Title Number</Label>
                <Input
                  id="title_number"
                  value={editValues.title_number}
                  onChange={(e) => setEditValues({ ...editValues, title_number: e.target.value })}
                  placeholder="e.g. BK123456"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tenure">Tenure</Label>
                <Select
                  value={editValues.tenure}
                  onValueChange={(value) => setEditValues({ ...editValues, tenure: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select tenure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Freehold">Freehold</SelectItem>
                    <SelectItem value="Leasehold">Leasehold</SelectItem>
                    <SelectItem value="Share of Freehold">Share of Freehold</SelectItem>
                    <SelectItem value="Commonhold">Commonhold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(editValues.tenure === 'Leasehold' || editValues.tenure === 'Share of Freehold') && (
                <div className="space-y-2">
                  <Label htmlFor="lease_years">Lease Years Remaining</Label>
                  <Input
                    id="lease_years"
                    type="number"
                    value={editValues.lease_years_remaining}
                    onChange={(e) => setEditValues({ ...editValues, lease_years_remaining: e.target.value })}
                    placeholder="e.g. 125"
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="uprn">UPRN</Label>
                <Input
                  id="uprn"
                  value={editValues.uprn}
                  onChange={(e) => setEditValues({ ...editValues, uprn: e.target.value })}
                  placeholder="e.g. 10023456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="land_registry_link">Land Registry Link</Label>
                <Input
                  id="land_registry_link"
                  type="url"
                  value={editValues.land_registry_link}
                  onChange={(e) => setEditValues({ ...editValues, land_registry_link: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Title Number</span>
                <span>{titleNumber || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tenure</span>
                <span>{tenure || '—'}</span>
              </div>
              {tenure === 'Leasehold' && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Lease Years</span>
                  <span>{leaseYearsRemaining ? `${leaseYearsRemaining} years` : '—'}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">UPRN</span>
                <span>{uprn || '—'}</span>
              </div>
              {landRegistryLink && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Land Registry</span>
                  <a
                    href={landRegistryLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <MapPicker
        open={mapPickerOpen}
        onOpenChange={setMapPickerOpen}
        initialLat={latitude}
        initialLng={longitude}
        address={address}
        onSave={handleSaveCoordinates}
      />
    </>
  );
}
