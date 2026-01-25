import React, { useState } from 'react';
import { LegalOwnerCard } from './LegalOwnerCard';
import { BeneficialOwnersCard } from './BeneficialOwnersCard';
import { BeneficialOwnerEditor } from './BeneficialOwnerEditor';
import { LegalOwnershipEditor } from './LegalOwnershipEditor';
import type { BeneficialOwner } from '@/hooks/useBeneficialOwnership';

interface OwnershipSectionProps {
  propertyId: string;
}

export function OwnershipSection({ propertyId }: OwnershipSectionProps) {
  // Legal ownership editor state
  const [legalEditorOpen, setLegalEditorOpen] = useState(false);

  // Beneficial ownership editor state
  const [beneficialEditorOpen, setBeneficialEditorOpen] = useState(false);
  const [editingBeneficialOwner, setEditingBeneficialOwner] = useState<BeneficialOwner | null>(null);

  const handleEditLegalOwner = () => {
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
