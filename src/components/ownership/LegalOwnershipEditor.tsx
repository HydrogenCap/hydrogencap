import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Building2, User, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useCompanies, useCreateCompany, type CompanyType } from '@/hooks/useCompanies';
import { useParties, useCreateParty } from '@/hooks/useParties';
import { useProperty, useUpdateProperty } from '@/hooks/useProperties';
import {
  usePropertyBeneficialOwnership,
  useAddOwnershipLink,
  useDeleteOwnershipLink,
} from '@/hooks/useOwnershipLinks';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface LegalOwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type OwnerType = 'company' | 'individuals';

interface PendingOwner {
  partyId: string;
  partyName: string;
  percent: number;
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
  const { data: parties } = useParties();
  const { data: existingOwners } = usePropertyBeneficialOwnership(propertyId);
  const createCompany = useCreateCompany();
  const createParty = useCreateParty();
  const updateProperty = useUpdateProperty();
  const addOwnershipLink = useAddOwnershipLink();
  const deleteOwnershipLink = useDeleteOwnershipLink();

  const [ownerType, setOwnerType] = useState<OwnerType>('company');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [showNewCompanyForm, setShowNewCompanyForm] = useState(false);
  
  // New company form fields
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<CompanyType>('SPV');
  
  // Individual owners state
  const [pendingOwners, setPendingOwners] = useState<PendingOwner[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personSearchOpen, setPersonSearchOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedPersonPercent, setSelectedPersonPercent] = useState<string>('');
  
  // New person form
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const isSubmitting = updateProperty.isPending || addOwnershipLink.isPending;

  // Filter parties to only show individuals
  const individuals = useMemo(
    () => parties?.filter((party) => party.party_type === 'INDIVIDUAL') ?? [],
    [parties],
  );

  // Calculate totals
  const pendingTotal = pendingOwners.reduce((sum, o) => sum + o.percent, 0);
  const remainingPercent = 100 - pendingTotal;

  useEffect(() => {
    if (open) {
      const initialType: OwnerType = property?.legal_owner_company_id ? 'company' : 'individuals';
      setOwnerType(initialType);
      setSelectedCompanyId(property?.legal_owner_company_id || '');
      setShowNewCompanyForm(false);
      setNewCompanyName('');
      setNewCompanyNumber('');
      setNewCompanyType('SPV');
      
      // Initialize pending owners from existing ownership_links
      if (existingOwners && existingOwners.length > 0) {
        setPendingOwners(
          existingOwners.map(o => ({
            partyId: o.owner_party_id,
            partyName: o.owner_party?.display_name || 'Unknown',
            percent: Number(o.percent),
          }))
        );
      } else if (property?.legal_owner_party_id) {
        // Single person owner - convert to pending
        const person = individuals.find(p => p.id === property.legal_owner_party_id);
        if (person) {
          setPendingOwners([{
            partyId: person.id,
            partyName: person.display_name,
            percent: 100,
          }]);
        }
      } else {
        setPendingOwners([]);
      }
      
      setShowAddPerson(false);
      setSelectedPersonId('');
      setSelectedPersonPercent('');
      setShowNewPersonForm(false);
      setNewPersonName('');
    }
  }, [existingOwners, individuals, open, property?.legal_owner_company_id, property?.legal_owner_party_id]);

  const getErrorMessage = (error: unknown) =>
    error instanceof Error ? error.message : 'Failed to update ownership';

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
    } catch (error) {
      console.error('Failed to create company:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create company', variant: 'destructive' });
    }
  };

  const handleAddPerson = async () => {
    let partyId = selectedPersonId;
    let partyName = '';

    // Create new person if needed
    if (showNewPersonForm && newPersonName.trim()) {
      try {
        const newPerson = await createParty.mutateAsync({
          party_type: 'INDIVIDUAL',
          display_name: newPersonName.trim(),
        });
        partyId = newPerson.id;
        partyName = newPerson.display_name;
      } catch (error) {
        console.error('Failed to create person:', error);
        toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to create person', variant: 'destructive' });
        return;
      }
    } else {
      const person = individuals.find(p => p.id === partyId);
      partyName = person?.display_name || '';
    }

    if (!partyId) {
      toast({ title: 'Error', description: 'Please select or create a person', variant: 'destructive' });
      return;
    }

    const percent = parseFloat(selectedPersonPercent);
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      toast({ title: 'Error', description: 'Please enter a valid percentage', variant: 'destructive' });
      return;
    }

    if (percent > remainingPercent + 0.01) {
      toast({ title: 'Error', description: `Maximum available is ${remainingPercent.toFixed(1)}%`, variant: 'destructive' });
      return;
    }

    // Check for duplicate
    if (pendingOwners.some(o => o.partyId === partyId)) {
      toast({ title: 'Error', description: 'This person is already added', variant: 'destructive' });
      return;
    }

    setPendingOwners([...pendingOwners, { partyId, partyName, percent }]);
    setShowAddPerson(false);
    setSelectedPersonId('');
    setSelectedPersonPercent('');
    setShowNewPersonForm(false);
    setNewPersonName('');
  };

  const handleRemovePerson = (partyId: string) => {
    setPendingOwners(pendingOwners.filter(o => o.partyId !== partyId));
  };

  const handleSubmit = async () => {
    try {
      if (ownerType === 'company') {
        // Clear any existing individual ownership links
        if (existingOwners) {
          for (const owner of existingOwners) {
            await deleteOwnershipLink.mutateAsync({
              id: owner.id,
              subjectType: 'PROPERTY',
              subjectId: propertyId,
            });
          }
        }
        
        await updateProperty.mutateAsync({
          id: propertyId,
          legal_owner_company_id: selectedCompanyId || null,
          legal_owner_party_id: null,
        });
      } else {
        // Clear company owner
        await updateProperty.mutateAsync({
          id: propertyId,
          legal_owner_company_id: null,
          legal_owner_party_id: null,
        });

        // Delete existing ownership links
        if (existingOwners) {
          for (const owner of existingOwners) {
            await deleteOwnershipLink.mutateAsync({
              id: owner.id,
              subjectType: 'PROPERTY',
              subjectId: propertyId,
            });
          }
        }

        // Add new ownership links for each person
        for (const owner of pendingOwners) {
          await addOwnershipLink.mutateAsync({
            subject_type: 'PROPERTY',
            subject_id: propertyId,
            owner_party_id: owner.partyId,
            ownership_type: 'BENEFICIAL',
            percent: owner.percent,
            source: 'manual',
          });
        }
      }
      
      toast({ title: 'Ownership updated' });
      onOpenChange(false);
    } catch (error) {
      toast({ title: 'Error', description: getErrorMessage(error), variant: 'destructive' });
    }
  };

  const handleClearOwnership = async () => {
    try {
      // Clear existing ownership links
      if (existingOwners) {
        for (const owner of existingOwners) {
          await deleteOwnershipLink.mutateAsync({
            id: owner.id,
            subjectType: 'PROPERTY',
            subjectId: propertyId,
          });
        }
      }
      
      await updateProperty.mutateAsync({
        id: propertyId,
        legal_owner_company_id: null,
        legal_owner_party_id: null,
      });
      toast({ title: 'Ownership cleared' });
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to clear ownership:', error);
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to clear ownership', variant: 'destructive' });
    }
  };

  const selectedCompany = companies?.find(c => c.id === selectedCompanyId);
  const selectedPerson = individuals.find(p => p.id === selectedPersonId);
  const hasExistingOwner = property?.legal_owner_company_id || property?.legal_owner_party_id || (existingOwners?.length || 0) > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Set Legal Ownership</DialogTitle>
          <DialogDescription>
            Record who holds legal title to this property — an entity or an individual.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Owner Type Tabs */}
          <Tabs value={ownerType} onValueChange={(v) => { setOwnerType(v as OwnerType); }}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="company" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Company (SPV)
              </TabsTrigger>
              <TabsTrigger value="individuals" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Individuals
              </TabsTrigger>
            </TabsList>

            {/* Company Selection */}
            <TabsContent value="company" className="space-y-4 mt-4">
              {!showNewCompanyForm ? (
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
                    <Button aria-label="Add"
                      variant="outline"
                      size="icon"
                      onClick={() => setShowNewCompanyForm(true)}
                      title="Create new company"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    The beneficial ownership split will be derived from the company's shareholders.
                  </p>
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
            </TabsContent>

            {/* Individuals Selection */}
            <TabsContent value="individuals" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Add individual owners with their percentage splits. Total must equal 100%.
              </p>

              {/* Progress bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total allocated</span>
                  <span className={`font-medium ${Math.abs(pendingTotal - 100) < 0.5 ? 'text-success' : pendingTotal > 100 ? 'text-destructive' : 'text-warning'}`}>
                    {pendingTotal.toFixed(1)}%
                  </span>
                </div>
                <Progress value={Math.min(pendingTotal, 100)} className="h-2" />
              </div>

              {/* Current owners list */}
              {pendingOwners.length > 0 && (
                <div className="space-y-2">
                  {pendingOwners.map((owner) => (
                    <div
                      key={owner.partyId}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{owner.partyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{owner.percent}%</span>
                        <Button aria-label="Delete"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRemovePerson(owner.partyId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add person form */}
              {showAddPerson ? (
                <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                  <h4 className="font-medium text-sm">Add Owner</h4>
                  
                  {!showNewPersonForm ? (
                    <div className="space-y-2">
                      <Label className="text-xs">Person</Label>
                      <div className="flex gap-2">
                        <Popover open={personSearchOpen} onOpenChange={setPersonSearchOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className="flex-1 justify-start"
                            >
                              {selectedPerson ? (
                                <span className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  {selectedPerson.display_name}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">Select person...</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search people..." />
                              <CommandList>
                                <CommandEmpty>
                                  <p className="text-sm text-muted-foreground p-2">No people found</p>
                                </CommandEmpty>
                                <CommandGroup>
                                  {individuals.map((party) => (
                                    <CommandItem
                                      key={party.id}
                                      value={party.display_name}
                                      onSelect={() => {
                                        setSelectedPersonId(party.id);
                                        setPersonSearchOpen(false);
                                      }}
                                    >
                                      <User className="mr-2 h-4 w-4" />
                                      {party.display_name}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <Button aria-label="Add"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowNewPersonForm(true)}
                          title="Create new person"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label className="text-xs">New Person Name</Label>
                      <Input
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        placeholder="e.g., David O'Neill"
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setShowNewPersonForm(false); setNewPersonName(''); }}
                      >
                        Select existing instead
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-xs">Ownership %</Label>
                    <Input
                      type="number"
                      value={selectedPersonPercent}
                      onChange={(e) => setSelectedPersonPercent(e.target.value)}
                      placeholder={`Max ${remainingPercent.toFixed(1)}%`}
                      min="0.01"
                      max="100"
                      step="0.01"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowAddPerson(false);
                        setSelectedPersonId('');
                        setSelectedPersonPercent('');
                        setShowNewPersonForm(false);
                        setNewPersonName('');
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleAddPerson}
                      disabled={createParty.isPending}
                    >
                      Add
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowAddPerson(true)}
                  disabled={remainingPercent < 0.01}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Owner
                </Button>
              )}

              {/* Validation alert */}
              {pendingOwners.length > 0 && Math.abs(pendingTotal - 100) > 0.5 && (
                <Alert variant={pendingTotal > 100 ? 'destructive' : 'default'} className="border-warning bg-warning/10">
                  <AlertDescription className="text-warning">
                    Total is {pendingTotal.toFixed(1)}% — must equal 100% to save
                  </AlertDescription>
                </Alert>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex justify-between">
          <div>
            {hasExistingOwner && (
              <Button variant="ghost" onClick={handleClearOwnership} disabled={isSubmitting}>
                Clear Ownership
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={
                isSubmitting || 
                (ownerType === 'individuals' && (pendingOwners.length === 0 || Math.abs(pendingTotal - 100) > 0.5))
              }
            >
              {isSubmitting ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
