import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logError } from '@/lib/errorLogger';

export interface EPCData {
  epcRating?: string;
  propertyType?: string;
  builtYear?: number;
  constructionAgeBand?: string;
  tenure?: string;
  floorArea?: number;
  bedrooms?: number;
  address?: string;
  lodgementDate?: string;
  expiryDate?: string;
}

export interface PostcodeData {
  localAuthority?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  postcodeArea?: string;
}

export interface CouncilTaxData {
  councilTaxBand?: string;
}

export interface PropertyLookupResult {
  success: boolean;
  epc?: EPCData;
  location?: PostcodeData;
  councilTax?: CouncilTaxData;
  errors?: string[];
  fieldsPopulated: string[];
}

export function usePropertyLookup() {
  const [isLooking, setIsLooking] = useState(false);
  const [lastResult, setLastResult] = useState<PropertyLookupResult | null>(null);
  const { toast } = useToast();

  const lookupProperty = async (
    postcode: string,
    addressLine?: string
  ): Promise<PropertyLookupResult | null> => {
    if (!postcode) {
      toast({
        title: 'Postcode required',
        description: 'Please enter a postcode to auto-populate property data.',
        variant: 'destructive',
      });
      return null;
    }

    setIsLooking(true);

    try {
      const { data, error } = await supabase.functions.invoke('property-lookup', {
        body: { postcode, addressLine },
      });

      if (error) {
        console.error('Property lookup error:', error);
        toast({
          title: 'Lookup failed',
          description: error.message || 'Failed to fetch property data.',
          variant: 'destructive',
        });
        return null;
      }

      const result = data as PropertyLookupResult;
      setLastResult(result);

      if (result.success && result.fieldsPopulated.length > 0) {
        toast({
          title: 'Data found!',
          description: `Auto-populated: ${result.fieldsPopulated.join(', ')}`,
        });
      } else if (result.errors?.length) {
        toast({
          title: 'Limited data available',
          description: result.errors.join('. '),
          variant: 'default',
        });
      }

      return result;
    } catch (err) {
      console.error('Property lookup error:', err);
      logError({ source: 'usePropertyLookup.lookupProperty', message: 'Property lookup edge function failed', severity: 'error', error: err });
      toast({
        title: 'Lookup failed',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsLooking(false);
    }
  };

  return {
    lookupProperty,
    isLooking,
    lastResult,
  };
}
