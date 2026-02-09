import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProperties } from './useProperties';
import { useAllCompliance } from './useCompliance';
import { usePropertyPassports } from './usePropertyPassport';
import { useCompanies, useCompany, type CompanyWithDetails } from './useCompanies';
import { logActivity } from './useActivityLog';
import {
  ReportFilters,
  PropertyReportData,
  PortfolioComplianceReport,
  PropertyCompliancePack,
  InsuranceBrokerPack,
} from '@/lib/reportPdfGenerator';
import { 
  LenderGradeMortgageBrokerPack, 
  type MortgageBrokerPackData,
  type PortfolioSummary,
  type CompanyData,
  validateMortgageBrokerPack,
} from '@/lib/mortgageBrokerPackGenerator';
import { format } from 'date-fns';

export type ReportType = 
  | 'portfolio_compliance' 
  | 'property_compliance_pack' 
  | 'mortgage_broker_pack' 
  | 'insurance_broker_pack';

export interface ReportTemplate {
  id: ReportType;
  name: string;
  description: string;
  icon: string;
  requiresSingleProperty: boolean;
  availableFor: ('core_rental' | 'development' | 'all')[];
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'portfolio_compliance',
    name: 'Portfolio Compliance Report',
    description: 'Comprehensive compliance overview across multiple properties with status summary and detailed breakdown.',
    icon: '📊',
    requiresSingleProperty: false,
    availableFor: ['core_rental', 'development', 'all'],
  },
  {
    id: 'property_compliance_pack',
    name: 'Property Compliance Pack',
    description: 'Council/licensing ready documentation pack with certificate index and compliance narrative.',
    icon: '📋',
    requiresSingleProperty: false,
    availableFor: ['core_rental', 'development', 'all'],
  },
  {
    id: 'mortgage_broker_pack',
    name: 'Mortgage Broker Pack',
    description: 'Lender-grade documentation for BTL/HMO mortgage applications. Includes deal summary, entity profile, portfolio track record, and document checklist.',
    icon: '🏦',
    requiresSingleProperty: false,
    availableFor: ['core_rental', 'development', 'all'],
  },
  {
    id: 'insurance_broker_pack',
    name: 'Insurance Broker Pack',
    description: 'Risk and building summary for insurance quotations including fire safety and relevant compliance documents.',
    icon: '🛡️',
    requiresSingleProperty: false,
    availableFor: ['core_rental', 'development', 'all'],
  },
];

// Fetch all data needed for reports
export function useReportData() {
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const { data: complianceItems, isLoading: complianceLoading } = useAllCompliance();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();
  const { data: companies, isLoading: companiesLoading } = useCompanies();

  const isLoading = propertiesLoading || complianceLoading || passportsLoading || companiesLoading;

  // Build enriched property data
  const enrichedProperties: PropertyReportData[] = (properties || []).map(prop => {
    const propCompliance = complianceItems?.filter(c => c.property_id === prop.id) || [];
    const passport = passports?.find(p => p.property_id === prop.id);
    const ownerCompany = companies?.find(c => c.id === prop.legal_owner_company_id);
    
    return {
      id: prop.id,
      address_line: prop.address_line,
      postcode: prop.postcode,
      lifecycle_type: prop.lifecycle_type || 'development',
      tenure: prop.tenure,
      beds: prop.beds,
      bathrooms: prop.bathrooms,
      property_type: prop.property_type,
      area_name: prop.area_name,
      current_value_gbp: prop.current_value_gbp,
      purchase_price_gbp: prop.purchase_price_gbp,
      original_purchase_date: prop.original_purchase_date,
      epc_rating: prop.epc_rating,
      is_hmo_licensed: prop.is_hmo_licensed,
      asset_category: prop.asset_category,
      legal_owner_company_id: prop.legal_owner_company_id,
      complianceItems: propCompliance.map(c => ({
        id: c.id,
        compliance_type: c.compliance_type,
        issue_date: c.issue_date,
        expiry_date: c.expiry_date,
        is_required: (c as any).is_required ?? null,
        is_manually_excluded: (c as any).is_manually_excluded ?? null,
        documents: c.documents?.map(d => ({
          file_url: d.file_url,
          original_file_name: d.original_file_name,
        })),
      })),
      loans: prop.loans?.map(l => ({
        lender: l.lender,
        current_mortgage_balance_gbp: l.current_mortgage_balance_gbp,
        interest_rate_percent: l.interest_rate_percent,
        fixed_rate_expires: l.fixed_rate_expires,
        capital_or_interest: l.capital_or_interest,
      })),
      income: prop.income?.map(i => ({
        annual_rent_gbp: i.annual_rent_gbp,
        year: i.year,
      })),
      passport: passport ? {
        construction_date_band: passport.construction_date_band,
        council_tax_band: passport.council_tax_band,
        local_authority_text: passport.local_authority_text,
      } : null,
      insurancePolicy: (prop as any).insurance_policies?.[0] || null,
      ownerName: ownerCompany?.legal_name,
    };
  });

  // Calculate portfolio summary for broker packs
  const portfolioSummary: PortfolioSummary = calculatePortfolioSummary(properties || []);

  return {
    properties: enrichedProperties,
    companies: companies || [],
    portfolioSummary,
    isLoading,
  };
}

// Calculate portfolio-level summary for broker packs
function calculatePortfolioSummary(properties: Array<{ current_value_gbp?: number | null; beds?: number | null; is_hmo_licensed?: boolean | null; loans?: Array<{ current_mortgage_balance_gbp?: number | null }> }>): PortfolioSummary {
  let totalValue = 0;
  let totalMortgageBalance = 0;
  let totalBedrooms = 0;
  let hmoCount = 0;

  properties.forEach(prop => {
    const value = prop.current_value_gbp ? Number(prop.current_value_gbp) : 0;
    const loan = prop.loans?.[0];
    const balance = loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : 0;
    const beds = prop.beds ? Number(prop.beds) : 0;

    totalValue += value;
    totalMortgageBalance += balance;
    totalBedrooms += beds;
    if (prop.is_hmo_licensed) hmoCount++;
  });

  const averageLTV = totalValue > 0 ? (totalMortgageBalance / totalValue) * 100 : null;

  return {
    totalProperties: properties.length,
    totalBedrooms,
    totalValue,
    totalMortgageBalance,
    averageLTV,
    hmoExperienceYears: hmoCount > 0 ? Math.max(2, hmoCount) : 0,
    hasArrears: false,
  };
}

// Fetch company details for mortgage broker pack
export function useCompanyForBrokerPack(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-broker-pack', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data: company, error } = await supabase
        .from('companies')
        .select(`
          id,
          legal_name,
          company_number,
          company_type,
          ch_registered_address,
          ch_incorporation_date,
          party_id
        `)
        .eq('id', companyId)
        .single();

      if (error) throw error;

      // Get shareholdings
      const { data: shareholdings } = await supabase
        .from('shareholdings')
        .select(`
          shares_held,
          shareholder_party:parties(display_name, party_type)
        `)
        .eq('company_id', companyId)
        .is('effective_to', null);

      // Calculate percentages from shares
      const totalShares = shareholdings?.reduce((sum, sh) => sum + (sh.shares_held || 0), 0) || 0;
      
      const shareholders = shareholdings?.map(sh => ({
        name: (sh.shareholder_party as any)?.display_name || 'Unknown',
        percent: totalShares > 0 ? ((sh.shares_held || 0) / totalShares) * 100 : 0,
        party_type: (sh.shareholder_party as any)?.party_type || 'INDIVIDUAL',
      })) || [];

      return {
        id: company.id,
        legal_name: company.legal_name,
        company_number: company.company_number,
        company_type: company.company_type,
        ch_registered_address: company.ch_registered_address,
        ch_incorporation_date: company.ch_incorporation_date,
        shareholders,
        directors: [], // Would need Companies House API call for real directors
      } as CompanyData;
    },
    enabled: !!companyId,
  });
}

// Filter properties based on report filters
export function filterProperties(
  properties: PropertyReportData[],
  filters: ReportFilters
): PropertyReportData[] {
  let filtered = [...properties];

  // Lifecycle filter
  if (filters.lifecycleType !== 'all') {
    filtered = filtered.filter(p => p.lifecycle_type === filters.lifecycleType);
  }

  // Property ID filter
  if (filters.propertyIds !== 'all') {
    filtered = filtered.filter(p => filters.propertyIds.includes(p.id));
  }

  return filtered;
}

// Validate if report can be generated
export function validateReportInputs(
  template: ReportTemplate,
  filters: ReportFilters,
  properties: PropertyReportData[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (template.requiresSingleProperty) {
    if (filters.propertyIds === 'all' || filters.propertyIds.length !== 1) {
      errors.push('This report requires exactly one property to be selected.');
    }
  }

  const filteredProps = filterProperties(properties, filters);
  if (filteredProps.length === 0) {
    errors.push('No properties match the selected filters.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Generate report mutation
export function useGenerateReport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      reportType,
      filters,
      properties,
      brokerNotes,
      brokerPackData,
    }: {
      reportType: ReportType;
      filters: ReportFilters;
      properties: PropertyReportData[];
      brokerNotes?: string;
      brokerPackData?: MortgageBrokerPackData;
    }) => {
      const filteredProps = filterProperties(properties, filters);
      
      if (filteredProps.length === 0) {
        throw new Error('No properties match the selected filters');
      }

      let report: { generate: () => void; getBlob: () => Blob };
      let filename: string;
      const dateStr = format(new Date(), 'yyyy-MM-dd');
      const timestamp = format(new Date(), 'HHmmss');

      switch (reportType) {
        case 'portfolio_compliance':
          report = new PortfolioComplianceReport(filteredProps, filters);
          filename = `Portfolio_Compliance_Report_${dateStr}_${timestamp}.pdf`;
          break;
          
        case 'property_compliance_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Property Compliance Pack requires exactly one property');
          }
          report = new PropertyCompliancePack(filteredProps[0], filters);
          filename = `Compliance_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}_${timestamp}.pdf`;
          break;
          
        case 'mortgage_broker_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Mortgage Broker Pack requires exactly one property');
          }
          if (!brokerPackData) {
            throw new Error('Mortgage Broker Pack requires additional configuration');
          }
          // Validate before generating
          const validation = validateMortgageBrokerPack(brokerPackData);
          if (!validation.canGenerate) {
            throw new Error(validation.errors[0] || 'Missing required information');
          }
          report = new LenderGradeMortgageBrokerPack(brokerPackData);
          filename = `Mortgage_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}_${timestamp}.pdf`;
          break;
          
        case 'insurance_broker_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Insurance Broker Pack requires exactly one property');
          }
          report = new InsuranceBrokerPack(filteredProps[0]);
          filename = `Insurance_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}_${timestamp}.pdf`;
          break;
          
        default:
          throw new Error('Unknown report type');
      }

      // Generate PDF
      report.generate();
      const blob = report.getBlob();

      // Upload to storage with unique timestamp to avoid conflicts
      const storagePath = `reports/${reportType}/${dateStr}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, { 
          contentType: 'application/pdf',
          upsert: true, // Overwrite if exists
        });

      if (uploadError) {
        console.warn('Failed to save report to storage:', uploadError);
        // Continue anyway - download will still work
      }

      // Log activity for each property
      const template = REPORT_TEMPLATES.find(t => t.id === reportType);
      for (const prop of filteredProps) {
        try {
          await logActivity({
            property_id: prop.id,
            entry_type: 'document_uploaded',
            title: `Generated ${template?.name || reportType} PDF`,
            body: `Report generated for ${filteredProps.length} ${filteredProps.length === 1 ? 'property' : 'properties'}`,
            metadata: {
              report_type: reportType,
              filters: {
                lifecycle: filters.lifecycleType,
                asOfDate: format(filters.asOfDate, 'yyyy-MM-dd'),
              },
            },
          });
        } catch (err) {
          console.warn('Failed to log activity:', err);
        }
      }

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return { success: true, filename };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activity_log'] });
    },
  });
}

// Re-export types for use in Reports page
export type { MortgageBrokerPackData, PortfolioSummary, CompanyData } from '@/lib/mortgageBrokerPackGenerator';
export { validateMortgageBrokerPack } from '@/lib/mortgageBrokerPackGenerator';
