import React, { useState, useEffect } from 'react';
import { Plus, Building2, Search, User } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompanies, useCreateCompany, type CompanyType } from '@/hooks/useCompanies';
import { useParties, useCreateParty } from '@/hooks/useParties';
import { useProperty, useUpdateProperty } from '@/hooks/useProperties';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LegalOwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OwnerType = 'company' | 'person';

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
  const { data: parties } = useParties();
  const createCompany = useCreateCompany();
  const createParty = useCreateParty();
  const updateProperty = useUpdateProperty();

  // Determine initial owner type based on existing data
  const getInitialOwnerType = (): OwnerType => {
    if (property?.legal_owner_party_id) return 'person';
    return 'company';
  };

  const [ownerType, setOwnerType] = useState<OwnerType>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  
  // New company form fields
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<CompanyType>('SPV');
  
  // New person form fields
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');

  const isSubmitting = updateProperty.isPending;

  // Filter parties to only show individuals
  const individuals = parties?.filter(p => p.party_type === 'INDIVIDUAL') || [];

  useEffect(() => {
    if (open) {
      const initialType = getInitialOwnerType();
      setOwnerType(initialType);
      setSelectedCompanyId(property?.legal_owner_company_id || '');
      setSelectedPartyId(property?.legal_owner_party_id || '');
      setShowNewForm(false);
      setNewCompanyName('');
      setNewCompanyNumber('');
      setNewCompanyType('SPV');
      setNewPersonName('');
      setNewPersonEmail('');
    }
  }, [open, property?.legal_owner_company_id, property?.legal_owner_party_id]);

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
      setShowNewForm(false);
      toast({ title: 'Company created', description: `${newCompanyName} has been created` });
    } catch {
      toast({ title: 'Error', description: 'Failed to create company', variant: 'destructive' });
    }
  };

  const handleCreatePerson = async () => {
    if (!newPersonName.trim()) {
      toast({ title: 'Error', description: 'Person name is required', variant: 'destructive' });
      return;
    }

    try {
      const newPerson = await createParty.mutateAsync({
        party_type: 'INDIVIDUAL',
        display_name: newPersonName.trim(),
        email: newPersonEmail.trim() || undefined,
      });
      setSelectedPartyId(newPerson.id);
      setShowNewForm(false);
      toast({ title: 'Person added', description: `${newPersonName} has been added` });
    } catch {
      toast({ title: 'Error', description: 'Failed to add person', variant: 'destructive' });
    }
  };

  const handleSubmit = async () => {
    try {
      if (ownerType === 'company') {
        await updateProperty.mutateAsync({
          id: propertyId,
          legal_owner_company_id: selectedCompanyId || null,
          legal_owner_party_id: null, // Clear party when setting company
        });
      } else {
        await updateProperty.mutateAsync({
          id: propertyId,
          legal_owner_company_id: null, // Clear company when setting party
          legal_owner_party_id: selectedPartyId || null,
        });
      }
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
        legal_owner_party_id: null,
      });
      toast({ title: 'Legal owner removed' });
      onOpenChange(false);
    } catch {
      toast({ title: 'Error', description: 'Failed to remove legal owner', variant: 'destructive' });
    }
  };

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
  const selectedParty = individuals.find(p => p.id === selectedPartyId);
  const hasExistingOwner = property?.legal_owner_company_id || property?.legal_owner_party_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Set Legal Owner</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Owner Type Tabs */}
          <Tabs value={ownerType} onValueChange={(v) => { setOwnerType(v as OwnerType); setShowNewForm(false); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company
              </TabsTrigger>
              <TabsTrigger value="person" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Person
              </TabsTrigger>
            </TabsList>

            {/* Company Selection */}
            <TabsContent value="company" className="space-y-4 mt-4">
              {!showNewForm ? (
                <div className="space-y-2">
                  <Label>Select Company</Label>
                  <div className="flex gap-2">
                    <Popover open={searchOpen && ownerType === 'company'} onOpenChange={setSearchOpen}>
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
                      onClick={() => setShowNewForm(true)}
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
                    <Button variant="outline" onClick={() => setShowNewForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateCompany} disabled={createCompany.isPending}>
                      {createCompany.isPending ? 'Creating...' : 'Create Company'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Person Selection */}
            <TabsContent value="person" className="space-y-4 mt-4">
              {!showNewForm ? (
                <div className="space-y-2">
                  <Label>Select Person</Label>
                  <div className="flex gap-2">
                    <Popover open={searchOpen && ownerType === 'person'} onOpenChange={setSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={searchOpen}
                          className="flex-1 justify-between"
                        >
                          {selectedParty ? (
                            <span className="flex items-center gap-2">
                              <User className="h-4 w-4" />
                              {selectedParty.display_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Search people...</span>
                          )}
                          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search people..." />
                          <CommandList>
                            <CommandEmpty>No person found.</CommandEmpty>
                            <CommandGroup>
                              {individuals.map((party) => (
                                <CommandItem
                                  key={party.id}
                                  value={party.display_name}
                                  onSelect={() => {
                                    setSelectedPartyId(party.id);
                                    setSearchOpen(false);
                                  }}
                                >
                                  <User className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedPartyId === party.id ? "text-primary" : "text-muted-foreground"
                                  )} />
                                  <div className="flex flex-col">
                                    <span>{party.display_name}</span>
                                    {party.email && (
                                      <span className="text-xs text-muted-foreground">{party.email}</span>
                                    )}
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
                      onClick={() => setShowNewForm(true)}
                      title="Add new person"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium">Add New Person</h4>
                  <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input
                      value={newPersonName}
                      onChange={(e) => setNewPersonName(e.target.value)}
                      placeholder="e.g., David O'Neill"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email (optional)</Label>
                    <Input
                      type="email"
                      value={newPersonEmail}
                      onChange={(e) => setNewPersonEmail(e.target.value)}
                      placeholder="e.g., david@example.com"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setShowNewForm(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreatePerson} disabled={createParty.isPending}>
                      {createParty.isPending ? 'Adding...' : 'Add Person'}
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Info about what this means */}
          <p className="text-sm text-muted-foreground">
            The Legal Owner is the entity that appears on the property title — either a company (SPV) or an individual person.
          </p>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {hasExistingOwner && (
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
