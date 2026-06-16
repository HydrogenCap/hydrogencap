import type { CompanyType } from '@/hooks/useCompanies';

export type OwnerType = 'company' | 'individuals';

export interface PendingOwner {
  partyId: string;
  partyName: string;
  percent: number;
}

export const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'SPV', label: 'SPV (Property Holding)' },
  { value: 'HOLDCO', label: 'Holding Company' },
  { value: 'OPCO', label: 'Operating Company' },
  { value: 'OTHER', label: 'Other' },
];
