/// <reference types="google.maps" />
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, MapPin, AlertCircle, Check } from 'lucide-react';
import { useGoogleMaps } from './GoogleMapsProvider';
import { invokeEdgeFunction } from '@/hooks/useEdgeFunction';

declare global {
  interface Window {
    google?: typeof google;
  }
}
import { cn } from '@/lib/utils';

export interface AddressData {
  place_id: string;
  formatted_address: string;
  address_line: string;
  address_line2?: string | null;
  postcode?: string | null;
  town_city?: string | null;
  county?: string | null;
  country: string;
  latitude: number;
  longitude: number;
  geocode_confidence: 'exact' | 'approximate' | 'unknown';
  geocode_source: 'PLACES' | 'GEOCODE';
}

interface AddressAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  onAddressSelect?: (data: AddressData) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function AddressAutocomplete({
  value = '',
  onChange,
  onAddressSelect,
  placeholder = 'Start typing an address...',
  className,
  disabled,
}: AddressAutocompleteProps) {
  const { isLoaded } = useGoogleMaps();
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState<'none' | 'valid' | 'approximate' | 'invalid'>('none');
  const [inputValue, setInputValue] = useState(value);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (!isLoaded || !inputRef.current || !window.google?.maps?.places) {
      return;
    }

    // Clean up existing autocomplete
    if (autocompleteRef.current) {
      google.maps.event.clearInstanceListeners(autocompleteRef.current);
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: 'gb' },
      fields: ['place_id', 'formatted_address', 'address_components', 'geometry'],
      types: ['address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      
      if (!place.place_id || !place.geometry?.location) {
        setValidationStatus('invalid');
        return;
      }

      // Extract address components
      const components = place.address_components || [];
      const getComponent = (type: string) => 
        components.find(c => c.types.includes(type))?.long_name || null;

      const streetNumber = getComponent('street_number');
      const route = getComponent('route');
      const subpremise = getComponent('subpremise');
      const premise = getComponent('premise');
      
      let addressLine = '';
      if (subpremise) addressLine += subpremise + ', ';
      if (premise) addressLine += premise + ', ';
      if (streetNumber) addressLine += streetNumber + ' ';
      if (route) addressLine += route;
      addressLine = addressLine.trim().replace(/,$/, '');

      const addressData: AddressData = {
        place_id: place.place_id,
        formatted_address: place.formatted_address || '',
        address_line: addressLine || place.formatted_address?.split(',')[0] || '',
        address_line2: getComponent('locality') !== getComponent('postal_town') 
          ? getComponent('locality') 
          : null,
        postcode: getComponent('postal_code'),
        town_city: getComponent('postal_town') || getComponent('locality'),
        county: getComponent('administrative_area_level_2') || getComponent('administrative_area_level_1'),
        country: getComponent('country') || 'United Kingdom',
        latitude: place.geometry.location.lat(),
        longitude: place.geometry.location.lng(),
        geocode_confidence: 'exact', // Places API selections are typically exact
        geocode_source: 'PLACES',
      };

      setInputValue(addressData.formatted_address);
      onChange?.(addressData.address_line);
      onAddressSelect?.(addressData);
      setValidationStatus('valid');
    });

    autocompleteRef.current = autocomplete;

    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [isLoaded, onChange, onAddressSelect]);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Handle manual input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
    setValidationStatus('none');
  };

  // Validate address using server-side geocoding
  const validateAddress = useCallback(async () => {
    if (!inputValue.trim()) return;

    setIsValidating(true);
    try {
      const data = await invokeEdgeFunction<{ success: boolean; data: {
        place_id: string; formatted_address: string; address_line1: string;
        address_line2?: string | null; postcode?: string | null; town_city?: string | null;
        county?: string | null; country: string; latitude: number; longitude: number;
        geocode_confidence: 'exact' | 'approximate' | 'unknown';
      } }>('geocode-address', { address: inputValue });

      if (!data?.success) {
        setValidationStatus('invalid');
        return;
      }

      const result = data.data;
      const addressData: AddressData = {
        place_id: result.place_id,
        formatted_address: result.formatted_address,
        address_line: result.address_line1,
        address_line2: result.address_line2,
        postcode: result.postcode,
        town_city: result.town_city,
        county: result.county,
        country: result.country,
        latitude: result.latitude,
        longitude: result.longitude,
        geocode_confidence: result.geocode_confidence,
        geocode_source: 'GEOCODE',
      };

      setInputValue(result.formatted_address);
      onChange?.(result.address_line1);
      onAddressSelect?.(addressData);
      setValidationStatus(result.geocode_confidence === 'exact' ? 'valid' : 'approximate');
    } catch (err) {
      console.error('Address validation error:', err);
      setValidationStatus('invalid');
    } finally {
      setIsValidating(false);
    }
  }, [inputValue, onChange, onAddressSelect]);

  const statusIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
    }
    switch (validationStatus) {
      case 'valid':
        return <Check className="h-4 w-4 text-[hsl(var(--success))]" />;
      case 'approximate':
        return <AlertCircle className="h-4 w-4 text-[hsl(var(--warning))]" />;
      case 'invalid':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <MapPin className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={cn('pr-10', className)}
          disabled={disabled}
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {statusIcon()}
        </div>
      </div>
      
      {/* Validate button for manual entry */}
      {!isLoaded && inputValue && validationStatus === 'none' && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={validateAddress}
          disabled={isValidating}
          className="w-full"
        >
          {isValidating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <MapPin className="h-4 w-4 mr-2" />
              Validate Address
            </>
          )}
        </Button>
      )}

      {/* Warning for approximate geocoding */}
      {validationStatus === 'approximate' && (
        <p className="text-xs text-[hsl(var(--warning))] flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Address location is approximate - please verify on map
        </p>
      )}

      {validationStatus === 'invalid' && (
        <p className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Could not validate this address - please check and try again
        </p>
      )}
    </div>
  );
}
