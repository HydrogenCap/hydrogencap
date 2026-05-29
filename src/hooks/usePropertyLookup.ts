import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logError } from '@/lib/errorLogger';
import { toast } from "sonner";

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
  const lookupProperty = async (
    postcode: string,
    addressLine?: string
  ): Promise<PropertyLookupResult | null> => {
    if (!postcode) {
      toast.error('Postcode required', { description: 'Please enter a postcode to auto-populate property data.' });
      return null;
    }

    setIsLooking(true);

    try {
      const { data, error } = await supabase.functions.invoke('property-lookup', {
        body: { postcode, addressLine },
      });

      if (error) {
        console.error('Property lookup error:', error);
        toast.error('Lookup failed', { description: error.message || 'Failed to fetch property data.' });
        return null;
      }

      const result = data as PropertyLookupResult;
      setLastResult(result);

      if (result.success && result.fieldsPopulated.length > 0) {
        toast('Data found!', { description: `Auto-populated: ${result.fieldsPopulated.join(', ')}` });
      } else if (result.errors?.length) {
        toast('Limited data available', { description: result.errors.join('. ') });
      }

      return result;
    } catch (err) {
      console.error('Property lookup error:', err);
      logError({ source: 'usePropertyLookup.lookupProperty', message: 'Property lookup edge function failed', severity: 'error', error: err });
      toast.error('Lookup failed', { description: 'An unexpected error occurred.' });
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
