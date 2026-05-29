import type { RentScheduleWithDetails, RentItemDisplay } from './types';

export const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unknown error';

export function normalizeRentItem(item: RentScheduleWithDetails): RentItemDisplay {
  // Prefer V2 agreement data when available
  if (item.agreement) {
    const a = item.agreement;
    return {
      tenantName: `${a.tenant.first_name} ${a.tenant.last_name}`,
      tenantEmail: a.tenant.email,
      tenantPhone: a.tenant.phone,
      tenantId: a.tenant.id,
      roomName: a.room.room_name,
      roomId: a.room.id,
      propertyId: a.property.id,
      propertyAddress: `${a.property.address_line_1}, ${a.property.city}`,
      propertyPostcode: a.property.postcode,
      tenancyId: item.tenancy_id,
      agreementId: item.agreement_id,
    };
  }

  // Fallback to V1 tenancy data
  if (item.tenancy) {
    const t = item.tenancy;
    const tenantName = t.tenant.tenant_type === 'company'
      ? (t.tenant.company_name || `${t.tenant.first_name} ${t.tenant.last_name}`)
      : `${t.tenant.first_name} ${t.tenant.last_name}`;
    return {
      tenantName,
      tenantEmail: t.tenant.email || null,
      tenantPhone: t.tenant.phone || null,
      tenantId: t.tenant.id,
      roomName: t.room.room_name,
      roomId: null,
      propertyId: t.property.id,
      propertyAddress: t.property.address_line
        ? `${t.property.address_line}${t.property.town_city ? `, ${t.property.town_city}` : ''}`
        : 'Unknown',
      propertyPostcode: t.property.postcode,
      tenancyId: item.tenancy_id,
      agreementId: item.agreement_id,
    };
  }

  // Neither available (shouldn't happen)
  return {
    tenantName: 'Unknown',
    tenantEmail: null,
    tenantPhone: null,
    tenantId: '',
    roomName: 'Unknown',
    roomId: null,
    propertyId: '',
    propertyAddress: 'Unknown',
    propertyPostcode: null,
    tenancyId: item.tenancy_id,
    agreementId: item.agreement_id,
  };
}
