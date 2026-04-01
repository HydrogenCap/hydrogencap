import React, { useState, useEffect, useRef } from 'react';
import { Building2, Search, Loader2, ExternalLink } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SEVERITY } from '@/lib/design-tokens';
import { useCompaniesHouse, type CHCompanySearchResult } from '@/hooks/useCompaniesHouse';
import { cn } from '@/lib/utils';

interface CompanySearchInputProps {
  onSelect: (company: CHCompanySearchResult) => void;
  placeholder?: string;
  className?: string;
}

export function CompanySearchInput({ onSelect, placeholder = 'Search Companies House...', className }: CompanySearchInputProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { searchCompanies, searchResults, isSearching } = useCompaniesHouse();
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (query.length >= 2) {
      debounceRef.current = setTimeout(() => {
        searchCompanies(query);
        setIsOpen(true);
      }, 300);
    } else {
      setIsOpen(false);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, searchCompanies]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (company: CHCompanySearchResult) => {
    onSelect(company);
    setQuery('');
    setIsOpen(false);
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return SEVERITY.success.badge;
      case 'dissolved':
        return SEVERITY.critical.badge;
      default:
        return SEVERITY.neutral.badge;
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-9 pr-9"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && searchResults.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-80 overflow-auto">
          {searchResults.map((company) => (
            <button
              key={company.company_number}
              onClick={() => handleSelect(company)}
              className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border last:border-0"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{company.company_name}</p>
                    <p className="text-xs text-muted-foreground">{company.company_number}</p>
                    {company.address_snippet && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {company.address_snippet}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant="secondary" className={cn('text-xs shrink-0', getStatusColor(company.company_status))}>
                  {company.company_status}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.length >= 2 && !isSearching && searchResults.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg p-4 text-center text-sm text-muted-foreground">
          No companies found
        </div>
      )}
    </div>
  );
}
