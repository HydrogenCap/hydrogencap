export type WizardStep = 'browse' | 'select_context' | 'template_fields' | 'preview';

export interface TemplateFields {
  noticeDate?: string;
  earliestEndDate?: string;
  currentRent?: number;
  newRent?: number;
  increaseDate?: string;
  grounds?: string[];
  groundDetails?: string;
  earliestCourtDate?: string;
  guarantorName?: string;
  guarantorAddress?: string;
  guaranteedAmount?: number;
  date?: string;
  servedDate?: string;
  prospectName?: string;
  previousAddress?: string;
}

export const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  final: { label: 'Final', variant: 'default' },
  sent_for_signing: { label: 'Sent for Signing', variant: 'outline' },
  signed: { label: 'Signed', variant: 'default' },
};
