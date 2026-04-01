import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

export interface CHComplianceData {
  accounts_due_date: string | null;
  accounts_period_end: string | null;
  accounts_last_filed_date: string | null;
  confirmation_statement_due_date: string | null;
  confirmation_statement_last_made_up_to: string | null;
  confirmation_statement_last_filed_date: string | null;
}

export interface CHLookupResult {
  company: CHCompanyProfile;
  officers: CHOfficer[];
  significant_controllers: CHSignificantController[];
  compliance: CHComplianceData;
}

export function useCompaniesHouse() {
  const [isSearching, setIsSearching] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [searchResults, setSearchResults] = useState<CHCompanySearchResult[]>([]);
  const [lookupResult, setLookupResult] = useState<CHLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

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
    } catch (err) {
      console.error('Failed to search Companies House:', err);
      setError(err instanceof Error ? err.message : 'Failed to search Companies House');
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to search Companies House', variant: 'destructive' });
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
        compliance: data.compliance || {
          accounts_due_date: null,
          accounts_period_end: null,
          accounts_last_filed_date: null,
          confirmation_statement_due_date: null,
          confirmation_statement_last_made_up_to: null,
          confirmation_statement_last_filed_date: null,
        },
      };

      setLookupResult(result);
      return result;
    } catch (err) {
      console.error('Failed to look up company:', err);
      setError(err instanceof Error ? err.message : 'Failed to lookup company');
      toast({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to look up company', variant: 'destructive' });
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
