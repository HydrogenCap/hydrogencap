import React, { useState } from 'react';
import { LegalOwnerCard } from './LegalOwnerCard';
import { BeneficialOwnersCard } from './BeneficialOwnersCard';
import { BeneficialOwnerEditor } from './BeneficialOwnerEditor';
import { LegalOwnershipEditor } from './LegalOwnershipEditor';
import type { LegalOwnershipWithEntity } from '@/hooks/useOwnershipLookthrough';
import type { BeneficialOwner } from '@/hooks/useBeneficialOwnership';

interface OwnershipSectionProps {
  propertyId: string;
}

export function OwnershipSection({ propertyId }: OwnershipSectionProps) {
  // Legal ownership editor state
  const [legalEditorOpen, setLegalEditorOpen] = useState(false);
  const [editingLegalOwner, setEditingLegalOwner] = useState<LegalOwnershipWithEntity | null>(null);

  // Beneficial ownership editor state
  const [beneficialEditorOpen, setBeneficialEditorOpen] = useState(false);
  const [editingBeneficialOwner, setEditingBeneficialOwner] = useState<BeneficialOwner | null>(null);

  const handleEditLegalOwner = (ownership: LegalOwnershipWithEntity) => {
    setEditingLegalOwner(ownership);
    setLegalEditorOpen(true);
  };

  const handleAddLegalOwner = () => {
    setEditingLegalOwner(null);
    setLegalEditorOpen(true);
  };

  const handleAddBeneficialOwner = () => {
    setEditingBeneficialOwner(null);
    setBeneficialEditorOpen(true);
  };

  const handleEditBeneficialOwner = (owner: BeneficialOwner) => {
    setEditingBeneficialOwner(owner);
    setBeneficialEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Legal Owner (SPV) Card */}
      <LegalOwnerCard
        propertyId={propertyId}
        onEdit={handleEditLegalOwner}
        onAdd={handleAddLegalOwner}
      />

      {/* Beneficial Ownership Split Card */}
      <BeneficialOwnersCard
        propertyId={propertyId}
        onAddOwner={handleAddBeneficialOwner}
        onEditOwner={handleEditBeneficialOwner}
      />

      {/* Legal Ownership Editor Dialog */}
      <LegalOwnershipEditor
        propertyId={propertyId}
        open={legalEditorOpen}
        onOpenChange={setLegalEditorOpen}
        editingOwnership={editingLegalOwner}
      />

      {/* Beneficial Owner Editor Dialog */}
      <BeneficialOwnerEditor
        propertyId={propertyId}
        open={beneficialEditorOpen}
        onOpenChange={setBeneficialEditorOpen}
        editingOwner={editingBeneficialOwner}
      />
    </div>
  );
}
