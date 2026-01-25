import React, { useState, useEffect } from 'react';
import { Plus, Building2, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useCompanies, useCreateCompany, type CompanyType } from '@/hooks/useCompanies';
import { useProperty, useUpdateProperty } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LegalOwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'SPV', label: 'SPV (Property Holding)' },
  { value: 'HOLDCO', label: 'Holding Company' },
  { value: 'OPCO', label: 'Operating Company' },
  { value: 'OTHER', label: 'Other' },
];

export function LegalOwnershipEditor({
  propertyId,
  open,
  onOpenChange,
}: LegalOwnershipEditorProps) {
  const { toast } = useToast();
  const { data: property } = useProperty(propertyId);
  const { data: companies } = useCompanies();
  const createCompany = useCreateCompany();
  const updateProperty = useUpdateProperty();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<CompanyType>('SPV');

  const isSubmitting = updateProperty.isPending;

  useEffect(() => {
    if (open) {
      setSelectedCompanyId(property?.legal_owner_company_id || '');
      setShowNewCompanyForm(false);
      setNewCompanyName('');
      setNewCompanyNumber('');
      setNewCompanyType('SPV');
    }
  }, [open, property?.legal_owner_company_id]);

  const handleCreateCompany = async () => {
    if (!newCompanyName.trim()) {
      toast({ title: 'Error', description: 'Company name is required', variant: 'destructive' });
      return;
    }

    try {
      const newCompany = await createCompany.mutateAsync({
        legal_name: newCompanyName.trim(),
        company_number: newCompanyNumber.trim() || undefined,
        company_type: newCompanyType,
      });
      setSelectedCompanyId(newCompany.id);
      setShowNewCompanyForm(false);
      toast({ title: 'Company created', description: `${newCompanyName} has been created` });
    } catch {
      toast({ title: 'Error', description: 'Failed to create company', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    try {
      await updateProperty.mutateAsync({
        id: propertyId,
        legal_owner_company_id: selectedCompanyId || null,
      });
      toast({ title: 'Legal owner updated' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to update legal owner', variant: 'destructive' });
    }
  };

  const handleClearOwner = async () => {
    try {
      await updateProperty.mutateAsync({
        id: propertyId,
        legal_owner_company_id: null,
      });
      toast({ title: 'Legal owner removed' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to remove legal owner', variant: 'destructive' });
    }
  };

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Legal Owner (SPV)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Company Selection or Creation */}
          {!showNewCompanyForm ? (
            <div className="space-y-2">
              <Label>Select Company</Label>
              <div className="flex gap-2">
                <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={searchOpen}
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
                      <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search companies..." />
                      <CommandList>
                        <CommandEmpty>No company found.</CommandEmpty>
                        <CommandGroup>
                          {companies?.map((company) => (
                            <CommandItem
                              key={company.id}
                              value={company.legal_name}
                              onSelect={() => {
                                setSelectedCompanyId(company.id);
                                setSearchOpen(false);
                              }}
                            >
                              <Building2 className={cn(
                                "mr-2 h-4 w-4",
                                selectedCompanyId === company.id ? "text-primary" : "text-muted-foreground"
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
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewCompanyForm(true)}
                  title="Create new company"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
              <h4 className="font-medium">Create New Company</h4>
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  placeholder="e.g., Acme Properties Ltd"
                />
              </div>
              <div className="space-y-2">
                <Label>Company Number (optional)</Label>
                <Input
                  value={newCompanyNumber}
                  onChange={(e) => setNewCompanyNumber(e.target.value)}
                  placeholder="e.g., 12345678"
                />
              </div>
              <div className="space-y-2">
                <Label>Company Type</Label>
                <Select value={newCompanyType} onValueChange={(v) => setNewCompanyType(v as CompanyType)}>
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
                <Button variant="outline" onClick={() => setShowNewCompanyForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateCompany} disabled={createCompany.isPending}>
                  {createCompany.isPending ? 'Creating...' : 'Create Company'}
                </Button>
              </div>
            </div>
          )}

          {/* Info about what this means */}
          <p className="text-sm text-muted-foreground">
            The Legal Owner is the SPV or company that appears on the property title. 
            The beneficial ownership split is managed separately.
          </p>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {property?.legal_owner_company_id && (
              <Button variant="ghost" onClick={handleClearOwner} disabled={isSubmitting}>
                Remove Owner
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
