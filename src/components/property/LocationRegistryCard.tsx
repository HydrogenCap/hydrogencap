import React, { useState } from 'react';
import { MapPin, ExternalLink, Edit2, Check, X, Navigation, Loader2 } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';

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
  const [coordDialogOpen, setCoordDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Coordinate edit state
  const [coordLat, setCoordLat] = useState<string>('');
  const [coordLng, setCoordLng] = useState<string>('');

  // Edit form state
  const [editValues, setEditValues] = useState({
    title_number: titleNumber || '',
    tenure: tenure || '',
    lease_years_remaining: leaseYearsRemaining?.toString() || '',
    uprn: uprn || '',
    land_registry_link: landRegistryLink || '',
  });

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
      const { error } = await supabase
        .from('properties')
        .update({ latitude: lat, longitude: lng })
        .eq('id', propertyId);

      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['property', propertyId] });
      setCoordDialogOpen(false);
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
    } catch (error) {
      toast({
        title: 'Geocoding error',
        description: 'Failed to search for address.',
        variant: 'destructive',
      });
    } finally {
      setIsGeocoding(false);
    }
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

  // Generate static map URL for preview
  const getStaticMapUrl = () => {
    if (!hasCoordinates) return null;
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${latitude},${longitude}&zoom=15&size=400x150&markers=${latitude},${longitude},red-pushpin`;
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
          {/* Coordinates section */}
          <div>
            <Label className="text-muted-foreground text-sm">Coordinates</Label>
            {hasCoordinates ? (
              <div className="mt-2 space-y-2">
                <div className="h-[150px] rounded-lg overflow-hidden border border-border bg-muted">
                  <img 
                    src={getStaticMapUrl()!}
                    alt="Property location"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {latitude?.toFixed(6)}, {longitude?.toFixed(6)}
                  </span>
                  <Button variant="outline" size="sm" onClick={openCoordDialog}>
                    Update
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="w-full mt-2"
                onClick={openCoordDialog}
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

      {/* Coordinates Dialog */}
      <Dialog open={coordDialogOpen} onOpenChange={setCoordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Set Coordinates
            </DialogTitle>
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
                'Save Coordinates'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
