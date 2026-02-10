import type { PropertyPassport } from '@/hooks/usePropertyPassport';

interface PropertyWithPassport {
  id: string;
  address_line: string;
  postcode: string | null;
  area_name: string | null;
  property_type: string | null;
  listed_status: string | null;
  conservation_area: boolean | null;
  uprn: string | null;
  town_city: string | null;
  property_name: string | null;
  passport?: PropertyPassport | null;
}

const PASSPORT_COLUMNS: { key: string; header: string }[] = [
  { key: 'address_line', header: 'Address' },
  { key: 'postcode', header: 'Postcode' },
  { key: 'town_city', header: 'Town / City' },
  { key: 'area_name', header: 'Area' },
  { key: 'property_name', header: 'Property Name' },
  { key: 'property_type', header: 'Property Type' },
  { key: 'p.construction_type', header: 'Construction Type' },
  { key: 'listed_status', header: 'Listed Status' },
  { key: 'conservation_area', header: 'Conservation Area' },
  { key: 'uprn', header: 'UPRN' },
  // Passport operational fields
  { key: 'p.asset_agreement_category', header: 'Asset Agreement Category' },
  { key: 'p.asset_performance_rating', header: 'Asset Performance Rating' },
  { key: 'p.occupation_status', header: 'Occupation Status' },
  { key: 'p.owned_by', header: 'Owned By' },
  { key: 'p.council_tax_band', header: 'Council Tax Band' },
  { key: 'p.number_of_storeys', header: 'Storeys' },
  { key: 'p.kitchens', header: 'Kitchens' },
  { key: 'p.ensuites', header: 'Ensuites' },
  { key: 'p.living_rooms_communal', header: 'Communal Living Rooms' },
  { key: 'p.wc_cloakroom', header: 'WC / Cloakroom' },
  { key: 'p.parking', header: 'Parking' },
  { key: 'p.basement', header: 'Basement' },
  { key: 'p.carport', header: 'Carport' },
  { key: 'p.has_loft_access', header: 'Loft Access' },
  { key: 'p.loft_access', header: 'Loft Access Detail' },
  { key: 'p.access_ramp', header: 'Access Ramp' },
  { key: 'p.has_bin_store', header: 'Bin Store' },
  { key: 'p.has_cycle_store', header: 'Cycle Store' },
  { key: 'p.has_guest_room', header: 'Guest Room' },
  { key: 'p.has_gas_supply', header: 'Gas Supply' },
  { key: 'p.electric_meter_location', header: 'Electric Meter Location' },
  { key: 'p.electric_meter_number', header: 'Electric Meter Number' },
  { key: 'p.gas_meter_location', header: 'Gas Meter Location' },
  { key: 'p.gas_meter_number', header: 'Gas Meter Number' },
  { key: 'p.water_meter_location', header: 'Water Meter Location' },
  { key: 'p.water_meter_number', header: 'Water Meter Number' },
  { key: 'p.water_stop_tap_location', header: 'Water Stop Tap Location' },
  { key: 'p.keysafe_code', header: 'Keysafe Code' },
  { key: 'p.block_communal_entrance', header: 'Block Communal Entrance' },
  { key: 'p.communal_tv_supply', header: 'Communal TV Supply' },
  { key: 'p.oil_supplier', header: 'Oil Supplier' },
  { key: 'p.oil_tank_location', header: 'Oil Tank Location' },
  { key: 'p.oil_tank_capacity_litres', header: 'Oil Tank Capacity (L)' },
  { key: 'p.hmo_licence_required', header: 'HMO Licence Required' },
  { key: 'p.hmo_licence', header: 'HMO Licence' },
  { key: 'p.hmo_licence_number', header: 'HMO Licence Number' },
  { key: 'p.hmo_licence_expiry', header: 'HMO Licence Expiry' },
  { key: 'p.hmo_bed_spaces', header: 'HMO Bed Spaces' },
  { key: 'p.local_authority_text', header: 'Local Authority' },
  { key: 'p.management_company_text', header: 'Management Company' },
  { key: 'p.property_management_company', header: 'Property Management Company' },
  { key: 'p.property_management_fee_percent', header: 'Management Fee (%)' },
  { key: 'p.maintenance_area', header: 'Maintenance Area' },
  { key: 'p.built_in_year', header: 'Built In Year' },
  { key: 'p.construction_date_band', header: 'Construction Date Band' },
  { key: 'p.dropbox_link', header: 'Dropbox Link' },
  { key: 'p.photographs_link', header: 'Photographs Link' },
];

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getValue(property: PropertyWithPassport, key: string): unknown {
  if (key.startsWith('p.')) {
    const passportKey = key.slice(2);
    return property.passport?.[passportKey as keyof PropertyPassport] ?? '';
  }
  return (property as unknown as Record<string, unknown>)[key] ?? '';
}

export function exportPassportCSV(
  properties: PropertyWithPassport[],
  passportMap: Map<string, PropertyPassport>
) {
  const data = properties.map(p => ({
    ...p,
    passport: passportMap.get(p.id) || null,
  }));

  const headers = PASSPORT_COLUMNS.map(c => c.header);
  const rows = data.map(property =>
    PASSPORT_COLUMNS.map(col => escapeCSV(getValue(property, col.key)))
  );

  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `property-passports-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
