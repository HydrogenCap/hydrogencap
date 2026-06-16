import { Building2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { CompanyType } from '@/hooks/useCompanies';
import { COMPANY_TYPES } from './types';

interface Company {
  id: string;
  legal_name: string;
  company_type: CompanyType;
  company_number?: string | null;
}

interface Props {
  companies: Company[] | undefined;
  selectedCompanyId: string;
  setSelectedCompanyId: (id: string) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  ownerType: 'company' | 'individuals';
  showNewCompanyForm: boolean;
  setShowNewCompanyForm: (v: boolean) => void;
  newCompanyName: string;
  setNewCompanyName: (v: string) => void;
  newCompanyNumber: string;
  setNewCompanyNumber: (v: string) => void;
  newCompanyType: CompanyType;
  setNewCompanyType: (v: CompanyType) => void;
  onCreateCompany: () => void;
  createCompanyPending: boolean;
}

export function CompanyOwnerTab(p: Props) {
  const selectedCompany = p.companies?.find(c => c.id === p.selectedCompanyId);
  if (p.showNewCompanyForm) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
        <h4 className="font-medium">Create New Company</h4>
        <div className="space-y-2">
          <Label>Company Name</Label>
          <Input
            value={p.newCompanyName}
            onChange={(e) => p.setNewCompanyName(e.target.value)}
            placeholder="e.g., Acme Properties Ltd"
          />
        </div>
        <div className="space-y-2">
          <Label>Company Number (optional)</Label>
          <Input
            value={p.newCompanyNumber}
            onChange={(e) => p.setNewCompanyNumber(e.target.value)}
            placeholder="e.g., 12345678"
          />
        </div>
        <div className="space-y-2">
          <Label>Company Type</Label>
          <Select value={p.newCompanyType} onValueChange={(v) => p.setNewCompanyType(v as CompanyType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMPANY_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => p.setShowNewCompanyForm(false)}>
            Cancel
          </Button>
          <Button onClick={p.onCreateCompany} disabled={p.createCompanyPending}>
            {p.createCompanyPending ? 'Creating...' : 'Create Company'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Select Company</Label>
      <div className="flex gap-2">
        <Popover open={p.searchOpen && p.ownerType === 'company'} onOpenChange={p.setSearchOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={p.searchOpen}
              className="flex-1 justify-between"
            >
              {selectedCompany ? (
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {selectedCompany.legal_name}
                </span>
              ) : (
                <span className="text-muted-foreground">Search companies...</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[400px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search companies..." />
              <CommandList>
                <CommandEmpty>No company found.</CommandEmpty>
                <CommandGroup>
                  {p.companies?.map((company) => (
                    <CommandItem
                      key={company.id}
                      value={company.legal_name}
                      onSelect={() => {
                        p.setSelectedCompanyId(company.id);
                        p.setSearchOpen(false);
                      }}
                    >
                      <Building2 className={cn(
                        'mr-2 h-4 w-4',
                        p.selectedCompanyId === company.id ? 'text-primary' : 'text-muted-foreground',
                      )} />
                      <div className="flex flex-col">
                        <span>{company.legal_name}</span>
                        <span className="text-xs text-muted-foreground">
                          {company.company_type}
                          {company.company_number && ` • #${company.company_number}`}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          aria-label="Add"
          variant="outline"
          size="icon"
          onClick={() => p.setShowNewCompanyForm(true)}
          title="Create new company"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The beneficial ownership split will be derived from the company's shareholders.
      </p>
    </div>
  );
}
