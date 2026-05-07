import { generatePassportPDF, slugifyAddress, type PassportPropertyData } from '@/lib/pdf/passport';
import { supabase, supabaseAny } from '@/integrations/supabase/client';
import { fetchUserOrgId } from '@/hooks/useUserOrg';

interface BuildArgs {
  property: {
    id: string;
    address_line_1: string;
    address_line_2: string | null;
    city: string;
    postcode: string;
    property_type: string;
    current_valuation: number | null;
    [key: string]: unknown;
  };
  monthlyRent: number | null;
  loans: unknown[] | undefined;
  complianceRows: Array<{
    is_required: boolean;
    calculated_status?: string | null;
    expiry_date?: string | null;
    [key: string]: unknown;
  }> | undefined;
}

export async function buildAndSavePassportPdf({ property, monthlyRent, loans, complianceRows }: BuildArgs) {
  const [tenanciesRes, docsRes] = await Promise.all([
    supabaseAny
      .from('tenancy_agreements')
      .select('start_date, end_date, total_rent_pcm, tenants:tenancy_tenants(tenant:tenants_v2(first_name, last_name))')
      .eq('property_id', property.id)
      .eq('status', 'active')
      .limit(20),
    supabaseAny
      .from('documents')
      .select('original_file_name, display_name, doc_type, document_date, created_at')
      .eq('property_id', property.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(25),
  ]);

  type TenancyRow = {
    start_date: string | null;
    end_date: string | null;
    total_rent_pcm: number | null;
    tenants?: { tenant?: { first_name?: string | null; last_name?: string | null } | null }[] | null;
  };
  type DocRow = {
    original_file_name: string | null;
    display_name: string | null;
    doc_type: string | null;
    document_date: string | null;
    created_at: string | null;
  };

  const tenancyItems = ((tenanciesRes.data as TenancyRow[] | null) ?? []).map((t) => {
    const names = (t.tenants ?? [])
      .map((tt) => [tt.tenant?.first_name, tt.tenant?.last_name].filter(Boolean).join(' ').trim())
      .filter(Boolean);
    return {
      tenant_name: names.length ? names.join(', ') : 'Unnamed tenant',
      start_date: t.start_date,
      end_date: t.end_date,
      rent_pcm: t.total_rent_pcm,
    };
  });

  const documentItems = ((docsRes.data as DocRow[] | null) ?? []).map((d) => ({
    name: d.display_name || d.original_file_name || 'Document',
    doc_type: d.doc_type,
    date: d.document_date || d.created_at,
  }));

  const grossRentAnnual = monthlyRent ? monthlyRent * 12 : null;
  const totalDebt: number | null = (loans ?? [])
    .filter((l) => (l as { status?: string }).status === 'active')
    .reduce<number>((sum, l) => sum + ((l as { current_balance?: number | null }).current_balance || 0), 0) || null;
  const equity = property.current_valuation && totalDebt != null
    ? property.current_valuation - totalDebt
    : property.current_valuation ?? null;

  const complianceItems = (complianceRows ?? [])
    .filter((r) => r.is_required)
    .map((r) => {
      let status: 'valid' | 'expiring_soon' | 'expired' | 'missing' = 'valid';
      if (r.calculated_status === 'expired') status = 'expired';
      else if (r.calculated_status === 'missing') status = 'missing';
      else if (r.calculated_status === 'expiring_soon' || r.calculated_status === 'critical') status = 'expiring_soon';
      const rec = r as { requirement_type?: string; compliance_type?: string };
      return {
        type: String(rec.requirement_type ?? rec.compliance_type ?? 'Requirement'),
        status,
        expiry_date: r.expiry_date ?? null,
      };
    });

  const pdfData: PassportPropertyData = {
    address_line_1: property.address_line_1,
    address_line_2: property.address_line_2,
    city: property.city,
    postcode: property.postcode,
    property_type: property.property_type,
    bedrooms: (property as { bedrooms?: number | null }).bedrooms ?? null,
    monthly_rent: monthlyRent,
    current_valuation: property.current_valuation,
    owner_entity_name: (property as { entity_name?: string | null }).entity_name ?? null,
    cover_photo_data_url: null,
    compliance: complianceItems,
    tenancies: tenancyItems,
    financials: {
      gross_rent_annual: grossRentAnnual,
      total_costs_annual: null,
      noi_annual: null,
      mortgage_balance: totalDebt,
      equity,
    },
    documents: documentItems,
  };

  const doc = generatePassportPDF(pdfData);
  const slug = slugifyAddress(property.address_line_1 || 'property');
  const fileName = `passport-${slug}.pdf`;
  doc.save(fileName);

  try {
    const blob = doc.output('blob');
    const orgId = await fetchUserOrgId();
    if (orgId) {
      const path = `${orgId}/passport-exports/${property.id}/${Date.now()}-${fileName}`;
      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, blob, { contentType: 'application/pdf', upsert: false });
      if (!upErr) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabaseAny.from('documents').insert({
          org_id: orgId,
          property_id: property.id,
          file_url: path,
          original_file_name: fileName,
          display_name: `Property Passport — ${property.address_line_1}`,
          doc_type: 'property_passport_export',
          category: 'reports',
          file_type: 'pdf',
          mime_type: 'application/pdf',
          file_size_bytes: blob.size,
          review_status: 'accepted',
          uploaded_by: user?.id ?? null,
        });
      }
    }
  } catch (vaultErr) {
    console.warn('Passport PDF saved locally but vault upload failed:', vaultErr);
  }
}
