import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface CHCompanySearchResult {
  company_number: string;
  company_name: string;
  company_status: string;
  date_of_creation: string;
  address_snippet: string;
}

export interface CHCompanyProfile {
  company_number: string;
  company_name: string;
  company_status: string;
  company_type: string;
  date_of_creation: string;
  registered_address: string | null;
}

export interface CHOfficer {
  name: string;
  role: string;
  appointed_on: string;
}

export interface CHSignificantController {
  name: string;
  kind: string;
  natures_of_control: string[];
  notified_on: string;
}

export interface CHLookupResult {
  company: CHCompanyProfile;
  officers: CHOfficer[];
  significant_controllers: CHSignificantController[];
}

export function useCompaniesHouse() {
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [searchResults, setSearchResults] = useState<CHCompanySearchResult[]>([]);
  const [lookupResult, setLookupResult] = useState<CHLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const searchCompanies = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return [];
    }

    setIsSearching(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('companies-house-lookup', {
        body: { action: 'search', searchQuery: query }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      setSearchResults(data.companies || []);
      return data.companies || [];
    } catch (err: any) {
      console.error('Companies House search error:', err);
      setError(err.message || 'Failed to search Companies House');
      setSearchResults([]);
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  const lookupCompany = async (companyNumber: string): Promise<CHLookupResult | null> => {
    if (!companyNumber) return null;

    setIsLookingUp(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('companies-house-lookup', {
        body: { action: 'lookup', companyNumber }
      });

      if (fnError) throw fnError;
      if (data.error) throw new Error(data.error);

      const result: CHLookupResult = {
        company: data.company,
        officers: data.officers || [],
        significant_controllers: data.significant_controllers || [],
      };

      setLookupResult(result);
      return result;
    } catch (err: any) {
      console.error('Companies House lookup error:', err);
      setError(err.message || 'Failed to lookup company');
      setLookupResult(null);
      return null;
    } finally {
      setIsLookingUp(false);
    }
  };

  const clearResults = () => {
    setSearchResults([]);
    setLookupResult(null);
    setError(null);
  };

  return {
    searchCompanies,
    lookupCompany,
    clearResults,
    searchResults,
    lookupResult,
    isSearching,
    isLookingUp,
    error,
  };
}
