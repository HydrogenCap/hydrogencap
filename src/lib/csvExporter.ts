// CSV export utilities for property data

import type { PropertyWithFinancials } from '@/hooks/usePropertiesCompat';

export interface ExportableProperty {
  id: string;
  address_line: string;
  address_line2: string | null;
  area_name: string | null;
  postcode: string | null;
  property_type: string | null;
  beds: number | null;
  bathrooms: number | null;
  current_value_gbp: number | null;
  purchase_price_gbp: number | null;
  ownership_entity: string | null;
  ownership_percent: number | null;
  epc_rating: string | null;
  notes: string | null;
  // Loan fields
  mortgage_balance_gbp: number | null;
  lender: string | null;
  interest_rate_percent: number | null;
  mortgage_payment_gbp: number | null;
  fixed_rate_expires: string | null;
  // Income fields
  annual_rent_gbp: number | null;
}

// CSV column headers mapping
const CSV_COLUMNS: { key: keyof ExportableProperty; header: string }[] = [
  { key: 'id', header: 'Property ID' },
  { key: 'address_line', header: 'Address' },
  { key: 'address_line2', header: 'Address Line 2' },
  { key: 'area_name', header: 'Area' },
  { key: 'postcode', header: 'Postcode' },
  { key: 'property_type', header: 'Property Type' },
  { key: 'beds', header: 'Bedrooms' },
  { key: 'bathrooms', header: 'Bathrooms' },
  { key: 'current_value_gbp', header: 'Current Value (£)' },
  { key: 'purchase_price_gbp', header: 'Purchase Price (£)' },
  { key: 'ownership_entity', header: 'Ownership Entity' },
  { key: 'ownership_percent', header: 'Ownership %' },
  { key: 'epc_rating', header: 'EPC Rating' },
  { key: 'notes', header: 'Notes' },
  { key: 'mortgage_balance_gbp', header: 'Mortgage Balance (£)' },
  { key: 'lender', header: 'Lender' },
  { key: 'interest_rate_percent', header: 'Interest Rate (%)' },
  { key: 'mortgage_payment_gbp', header: 'Monthly Mortgage (£)' },
  { key: 'fixed_rate_expires', header: 'Fixed Rate Expires' },
  { key: 'annual_rent_gbp', header: 'Annual Rent (£)' },
];

function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const stringValue = String(value);
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function propertiesToExportable(properties: PropertyWithFinancials[]): ExportableProperty[] {
  return properties.map(property => {
    // Get the most recent loan
    const loan = property.loans?.[0];
    // Get the current year's income
    const currentYear = new Date().getFullYear();
    const income = property.income?.find(i => i.year === currentYear) || property.income?.[0];

    return {
      id: property.id,
      address_line: property.address_line,
      address_line2: property.address_line2,
      area_name: property.area_name,
      postcode: property.postcode,
      property_type: property.property_type,
      beds: property.beds,
      bathrooms: property.bathrooms,
      current_value_gbp: property.current_value_gbp ? Number(property.current_value_gbp) : null,
      purchase_price_gbp: property.purchase_price_gbp ? Number(property.purchase_price_gbp) : null,
      ownership_entity: property.ownership_entity,
      ownership_percent: property.ownership_percent ? Number(property.ownership_percent) : null,
      epc_rating: property.epc_rating,
      notes: property.notes,
      mortgage_balance_gbp: loan?.current_mortgage_balance_gbp ? Number(loan.current_mortgage_balance_gbp) : null,
      lender: loan?.lender ?? null,
      interest_rate_percent: loan?.interest_rate_percent ? Number(loan.interest_rate_percent) : null,
      mortgage_payment_gbp: loan?.mortgage_payment_gbp ? Number(loan.mortgage_payment_gbp) : null,
      fixed_rate_expires: loan?.fixed_rate_expires ?? null,
      annual_rent_gbp: income?.annual_rent_gbp ? Number(income.annual_rent_gbp) : null,
    };
  });
}

export function generateCSV(properties: PropertyWithFinancials[]): string {
  const exportable = propertiesToExportable(properties);
  
  // Generate header row
  const headers = CSV_COLUMNS.map(col => escapeCSVValue(col.header)).join(',');
  
  // Generate data rows
  const rows = exportable.map(property => {
    return CSV_COLUMNS.map(col => escapeCSVValue(property[col.key])).join(',');
  });

  return [headers, ...rows].join('\n');
}

export function downloadCSV(properties: PropertyWithFinancials[], filename: string = 'properties.csv'): void {
  const csv = generateCSV(properties);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
