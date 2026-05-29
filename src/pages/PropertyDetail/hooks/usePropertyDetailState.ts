import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast as sonnerToast } from 'sonner';
import { supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';
import { usePropertyV2, useUpdatePropertyV2 } from '@/hooks/usePropertiesV2';
import { usePropertyRoomSummaries } from '@/hooks/useRoomsV2';
import { usePropertyComplianceV2 } from '@/hooks/useComplianceV2';
import { useInsurancePolicies } from '@/hooks/useInsurance';
import { useLoanFacilitiesByProperty } from '@/hooks/useLoanFacilities';
import { usePropertyPhotoV2 } from '@/hooks/usePropertyPhotosV2';
import { buildAndSavePassportPdf } from '../utils/pdfExport';

export function usePropertyDetailState() {
  const { id } = useParams<{ id: string }>();
  const { data: property, isLoading } = usePropertyV2(id);
  const { data: roomSummaries } = usePropertyRoomSummaries();
  const updateProperty = useUpdatePropertyV2();
  const [showEdit, setShowEdit] = useState(false);
  const [showRecordValuation, setShowRecordValuation] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState('');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const coverPhoto = usePropertyPhotoV2(id);

  const { data: complianceRows } = usePropertyComplianceV2(id);
  const { data: insurancePolicies } = useInsurancePolicies({ propertyId: id });
  const { data: loans } = useLoanFacilitiesByProperty(id);

  const { data: entities = [] } = useQuery({
    queryKey: ['legal_entities_list'],
    queryFn: async () => {
      const orgId = await fetchUserOrgId();
      const { data, error } = await supabaseAny
        .from('legal_entities')
        .select('id, entity_name')
        .eq('org_id', orgId)
        .order('entity_name');
      if (error) throw error;
      return data as { id: string; entity_name: string }[];
    },
  });

  const { data: rentStatusData } = useQuery({
    queryKey: ['property_rent_status', id],
    enabled: !!id,
    queryFn: async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabaseAny
        .from('rent_schedule')
        .select(`
          status,
          agreement:tenancy_agreements!agreement_id(
            property:properties_v2!inner(id)
          )
        `)
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd);

      if (error) return null;
      if (!data || data.length === 0) return 'void' as const;

      type RentRow = { status: string; agreement?: { property?: { id?: string } } };
      const rows = data as RentRow[];
      const forProperty = rows.filter((r) => r.agreement?.property?.id === id);
      if (forProperty.length === 0) return 'void' as const;

      const statuses = forProperty.map((r) => r.status);
      if (statuses.every((s: string) => s === 'paid')) return 'paid' as const;
      if (statuses.some((s: string) => s === 'overdue' || s === 'bad_debt')) return 'overdue' as const;
      if (statuses.some((s: string) => s === 'partial')) return 'partial' as const;
      return 'paid' as const;
    },
  });

  const monthlyRent = useMemo(() => {
    if (!property) return null;
    if (property.rent_basis === 'whole_house') return property.whole_house_rent_pcm ?? null;
    return roomSummaries?.get(property.id)?.gross_rent_pcm ?? null;
  }, [property, roomSummaries]);

  const currentLtv = useMemo(() => {
    if (!loans || loans.length === 0 || !property?.current_valuation) return null;
    type LoanRow = { status: string; current_balance?: number | null };
    const totalDebt = (loans as LoanRow[])
      .filter((l) => l.status === 'active')
      .reduce((sum, l) => sum + (l.current_balance || 0), 0);
    if (totalDebt === 0 || !property.current_valuation) return null;
    return (totalDebt / property.current_valuation) * 100;
  }, [loans, property?.current_valuation]);

  const grossYield = useMemo(() => {
    if (!monthlyRent || !property?.current_valuation) return null;
    return ((monthlyRent * 12) / property.current_valuation) * 100;
  }, [monthlyRent, property]);

  const complianceCounts = useMemo(() => {
    if (!complianceRows) return { expired: 0, expiring: 0 };
    const required = complianceRows.filter(r => r.is_required);
    const expired = required.filter(r => r.calculated_status === 'expired' || r.calculated_status === 'missing').length;
    const expiring = required.filter(r => r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical').length;
    return { expired, expiring };
  }, [complianceRows]);

  const capitalGrowth = property?.current_valuation && property?.purchase_price
    ? ((property.current_valuation - property.purchase_price) / property.purchase_price * 100).toFixed(1)
    : null;

  const handleSaveNotes = async () => {
    if (!property) return;
    try {
      await updateProperty.mutateAsync({ id: property.id, notes: notesValue || null });
      setEditingNotes(false);
      sonnerToast.success('Notes saved');
    } catch (err) {
      console.error('Failed to save property notes:', err);
      sonnerToast.error('Error', { description: err instanceof Error ? err.message : 'Failed to save notes' });
    }
  };

  const handleDownloadPassportPdf = async () => {
    if (!property) return;
    setDownloadingPdf(true);
    try {
      await buildAndSavePassportPdf({ property: property as never, monthlyRent, loans, complianceRows: complianceRows as never });
      sonnerToast.success('Passport PDF downloaded');
    } catch (err) {
      console.error('Failed to generate passport PDF:', err);
      sonnerToast.error(err instanceof Error ? err.message : 'Failed to generate PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return {
    id,
    property,
    isLoading,
    updateProperty,
    showEdit, setShowEdit,
    showRecordValuation, setShowRecordValuation,
    editingNotes, setEditingNotes,
    notesValue, setNotesValue,
    downloadingPdf,
    coverPhoto,
    complianceRows,
    insurancePolicies,
    loans,
    entities,
    rentStatusData,
    monthlyRent,
    currentLtv,
    grossYield,
    complianceCounts,
    capitalGrowth,
    handleSaveNotes,
    handleDownloadPassportPdf,
  };
}
