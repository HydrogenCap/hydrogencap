import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useProperties } from './useProperties';
import { useAllCompliance } from './useCompliance';
import { usePropertyPassports } from './usePropertyPassport';
import { logActivity } from './useActivityLog';
import {
  ReportFilters,
  PropertyReportData,
  PortfolioComplianceReport,
  PropertyCompliancePack,
  MortgageBrokerPack,
  InsuranceBrokerPack,
} from '@/lib/reportPdfGenerator';
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
    description: 'Council/licensing ready documentation pack for a single property with certificate index and compliance narrative.',
    icon: '📋',
    requiresSingleProperty: true,
    availableFor: ['core_rental', 'development', 'all'],
  },
  {
    id: 'mortgage_broker_pack',
    name: 'Mortgage Broker Pack',
    description: 'Property and finance summary for mortgage applications including valuation, income, and document checklist.',
    icon: '🏦',
    requiresSingleProperty: true,
    availableFor: ['core_rental', 'development', 'all'],
  },
  {
    id: 'insurance_broker_pack',
    name: 'Insurance Broker Pack',
    description: 'Risk and building summary for insurance quotations including fire safety and relevant compliance documents.',
    icon: '🛡️',
    requiresSingleProperty: true,
    availableFor: ['core_rental', 'development', 'all'],
  },
];

// Fetch all data needed for reports
export function useReportData() {
  const { data: properties, isLoading: propertiesLoading } = useProperties();
  const { data: complianceItems, isLoading: complianceLoading } = useAllCompliance();
  const { data: passports, isLoading: passportsLoading } = usePropertyPassports();

  const isLoading = propertiesLoading || complianceLoading || passportsLoading;

  // Build enriched property data
  const enrichedProperties: PropertyReportData[] = (properties || []).map(prop => {
    const propCompliance = complianceItems?.filter(c => c.property_id === prop.id) || [];
    const passport = passports?.find(p => p.property_id === prop.id);
    
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
      ownerName: undefined, // Would need to join with companies table
    };
  });

  return {
    properties: enrichedProperties,
    isLoading,
  };
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
    }: {
      reportType: ReportType;
      filters: ReportFilters;
      properties: PropertyReportData[];
      brokerNotes?: string;
    }) => {
      const filteredProps = filterProperties(properties, filters);
      
      if (filteredProps.length === 0) {
        throw new Error('No properties match the selected filters');
      }

      let report;
      let filename: string;
      const dateStr = format(new Date(), 'yyyy-MM-dd');

      switch (reportType) {
        case 'portfolio_compliance':
          report = new PortfolioComplianceReport(filteredProps, filters);
          filename = `Portfolio_Compliance_Report_${dateStr}.pdf`;
          break;
          
        case 'property_compliance_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Property Compliance Pack requires exactly one property');
          }
          report = new PropertyCompliancePack(filteredProps[0], filters);
          filename = `Compliance_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`;
          break;
          
        case 'mortgage_broker_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Mortgage Broker Pack requires exactly one property');
          }
          report = new MortgageBrokerPack(filteredProps[0], brokerNotes || '');
          filename = `Mortgage_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`;
          break;
          
        case 'insurance_broker_pack':
          if (filteredProps.length !== 1) {
            throw new Error('Insurance Broker Pack requires exactly one property');
          }
          report = new InsuranceBrokerPack(filteredProps[0]);
          filename = `Insurance_Pack_${filteredProps[0].address_line.replace(/[^a-zA-Z0-9]/g, '_')}_${dateStr}.pdf`;
          break;
          
        default:
          throw new Error('Unknown report type');
      }

      // Generate PDF
      report.generate();
      const blob = report.getBlob();

      // Upload to storage
      const storagePath = `reports/${reportType}/${dateStr}/${filename}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, blob, { contentType: 'application/pdf' });

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
