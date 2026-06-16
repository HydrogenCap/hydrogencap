import { useEffect, useMemo, useState } from 'react';
import { Building2, User } from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCompanies, useCreateCompany, type CompanyType } from '@/hooks/useCompanies';
import { useParties, useCreateParty } from '@/hooks/useParties';
import { useProperty, useUpdateProperty } from '@/hooks/useProperties';
import {
  usePropertyBeneficialOwnership,
  useAddOwnershipLink,
  useDeleteOwnershipLink,
} from '@/hooks/useOwnershipLinks';
import { toast } from 'sonner';

import type { OwnerType, PendingOwner } from './legal-editor/types';
import { CompanyOwnerTab } from './legal-editor/CompanyOwnerTab';
import { IndividualsOwnerTab } from './legal-editor/IndividualsOwnerTab';

interface LegalOwnershipEditorProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LegalOwnershipEditor({ propertyId, open, onOpenChange }: LegalOwnershipEditorProps) {
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

  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyNumber, setNewCompanyNumber] = useState('');
  const [newCompanyType, setNewCompanyType] = useState<CompanyType>('SPV');

  const [pendingOwners, setPendingOwners] = useState<PendingOwner[]>([]);
  const [showAddPerson, setShowAddPerson] = useState(false);
  const [personSearchOpen, setPersonSearchOpen] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');
  const [selectedPersonPercent, setSelectedPersonPercent] = useState<string>('');

  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');

  const isSubmitting = updateProperty.isPending || addOwnershipLink.isPending;

  const individuals = useMemo(
    () => parties?.filter((party) => party.party_type === 'INDIVIDUAL') ?? [],
    [parties],
  );

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

      if (existingOwners && existingOwners.length > 0) {
        setPendingOwners(
          existingOwners.map(o => ({
            partyId: o.owner_party_id,
            partyName: o.owner_party?.display_name || 'Unknown',
            percent: Number(o.percent),
          })),
        );
      } else if (property?.legal_owner_party_id) {
        const person = individuals.find(p => p.id === property.legal_owner_party_id);
        if (person) {
          setPendingOwners([{ partyId: person.id, partyName: person.display_name, percent: 100 }]);
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
      toast.error('Error', { description: 'Company name is required' });
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
      toast.success('Company created', { description: `${newCompanyName} has been created` });
    } catch (error) {
      console.error('Failed to create company:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create company' });
    }
  };

  const handleAddPerson = async () => {
    let partyId = selectedPersonId;
    let partyName = '';

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
        toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to create person' });
        return;
      }
    } else {
      const person = individuals.find(p => p.id === partyId);
      partyName = person?.display_name || '';
    }

    if (!partyId) {
      toast.error('Error', { description: 'Please select or create a person' });
      return;
    }

    const percent = parseFloat(selectedPersonPercent);
    if (isNaN(percent) || percent <= 0 || percent > 100) {
      toast.error('Error', { description: 'Please enter a valid percentage' });
      return;
    }

    if (percent > remainingPercent + 0.01) {
      toast.error('Error', { description: `Maximum available is ${remainingPercent.toFixed(1)}%` });
      return;
    }

    if (pendingOwners.some(o => o.partyId === partyId)) {
      toast.error('Error', { description: 'This person is already added' });
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
        await updateProperty.mutateAsync({
          id: propertyId,
          legal_owner_company_id: null,
          legal_owner_party_id: null,
        });

        if (existingOwners) {
          for (const owner of existingOwners) {
            await deleteOwnershipLink.mutateAsync({
              id: owner.id,
              subjectType: 'PROPERTY',
              subjectId: propertyId,
            });
          }
        }

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

      toast.success('Ownership updated');
      onOpenChange(false);
    } catch (error) {
      toast.error('Error', { description: getErrorMessage(error) });
    }
  };

  const handleClearOwnership = async () => {
    try {
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
      toast.success('Ownership cleared');
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to clear ownership:', error);
      toast.error('Error', { description: error instanceof Error ? error.message : 'Failed to clear ownership' });
    }
  };

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

            <TabsContent value="company" className="space-y-4 mt-4">
              <CompanyOwnerTab
                companies={companies}
                selectedCompanyId={selectedCompanyId}
                setSelectedCompanyId={setSelectedCompanyId}
                searchOpen={searchOpen}
                setSearchOpen={setSearchOpen}
                ownerType={ownerType}
                showNewCompanyForm={showNewCompanyForm}
                setShowNewCompanyForm={setShowNewCompanyForm}
                newCompanyName={newCompanyName}
                setNewCompanyName={setNewCompanyName}
                newCompanyNumber={newCompanyNumber}
                setNewCompanyNumber={setNewCompanyNumber}
                newCompanyType={newCompanyType}
                setNewCompanyType={setNewCompanyType}
                onCreateCompany={handleCreateCompany}
                createCompanyPending={createCompany.isPending}
              />
            </TabsContent>

            <TabsContent value="individuals" className="space-y-4 mt-4">
              <IndividualsOwnerTab
                individuals={individuals}
                pendingOwners={pendingOwners}
                pendingTotal={pendingTotal}
                remainingPercent={remainingPercent}
                onRemovePerson={handleRemovePerson}
                showAddPerson={showAddPerson}
                setShowAddPerson={setShowAddPerson}
                personSearchOpen={personSearchOpen}
                setPersonSearchOpen={setPersonSearchOpen}
                selectedPersonId={selectedPersonId}
                setSelectedPersonId={setSelectedPersonId}
                selectedPersonPercent={selectedPersonPercent}
                setSelectedPersonPercent={setSelectedPersonPercent}
                showNewPersonForm={showNewPersonForm}
                setShowNewPersonForm={setShowNewPersonForm}
                newPersonName={newPersonName}
                setNewPersonName={setNewPersonName}
                onAddPerson={handleAddPerson}
                createPartyPending={createParty.isPending}
              />
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
