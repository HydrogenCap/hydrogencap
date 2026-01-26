import React, { useState } from 'react';
import { LegalOwnerCard } from './LegalOwnerCard';
import { DerivedBeneficialOwnershipCard } from './DerivedBeneficialOwnershipCard';
import { LegalOwnershipEditor } from './LegalOwnershipEditor';

interface OwnershipSectionProps {
  propertyId: string;
}

export function OwnershipSection({ propertyId }: OwnershipSectionProps) {
  // Legal ownership editor state
  const [legalEditorOpen, setLegalEditorOpen] = useState(false);

  const handleEditLegalOwner = () => {
    setLegalEditorOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Legal Owner (SPV) Card */}
      <LegalOwnerCard
        propertyId={propertyId}
        onEdit={handleEditLegalOwner}
      />

      {/* Beneficial Ownership Split - Derived from Company Shareholders */}
      <DerivedBeneficialOwnershipCard propertyId={propertyId} />

      {/* Legal Ownership Editor Dialog */}
      <LegalOwnershipEditor
        propertyId={propertyId}
        open={legalEditorOpen}
        onOpenChange={setLegalEditorOpen}
      />
    </div>
  );
}
