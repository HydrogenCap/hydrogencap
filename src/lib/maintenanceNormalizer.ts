/**
 * Normalized display data for maintenance items.
 * All UI components use this instead of accessing V1/V2 joins directly.
 */
export interface MaintenanceDisplay {
  propertyId: string;
  propertyAddress: string;
  propertyPostcode: string | null;
  roomId: string | null;
  roomName: string | null;
  tenantId: string | null;
  tenantName: string | null;
  tenantEmail: string | null;
  tenantPhone: string | null;
}

interface V1Joins {
  property_id: string;
  property?: { id: string; address_line: string; postcode: string | null } | null;
  room?: { id: string; room_name: string } | null;
  tenant?: { id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null } | null;
}

interface V2Joins {
  property_v2?: { id: string; address_line_1: string; city: string; postcode: string } | null;
  room_v2?: { id: string; room_name: string } | null;
  tenant_v2?: { id: string; first_name: string; last_name: string; email?: string | null; phone?: string | null } | null;
}

export function normalizeMaintenanceItem(item: V1Joins & V2Joins): MaintenanceDisplay {
  const useV2Prop = !!item.property_v2;
  const useV2Room = !!item.room_v2;
  const useV2Tenant = !!item.tenant_v2;

  return {
    propertyId: useV2Prop ? item.property_v2!.id : item.property_id,
    propertyAddress: useV2Prop
      ? `${item.property_v2!.address_line_1}, ${item.property_v2!.city}`
      : item.property?.address_line || 'Unknown',
    propertyPostcode: useV2Prop
      ? item.property_v2!.postcode
      : item.property?.postcode || null,
    roomId: useV2Room ? item.room_v2!.id : item.room?.id || null,
    roomName: useV2Room ? item.room_v2!.room_name : item.room?.room_name || null,
    tenantId: useV2Tenant ? item.tenant_v2!.id : item.tenant?.id || null,
    tenantName: useV2Tenant
      ? `${item.tenant_v2!.first_name} ${item.tenant_v2!.last_name}`
      : item.tenant ? `${item.tenant.first_name} ${item.tenant.last_name}` : null,
    tenantEmail: useV2Tenant ? item.tenant_v2!.email || null : item.tenant?.email || null,
    tenantPhone: useV2Tenant ? item.tenant_v2!.phone || null : item.tenant?.phone || null,
  };
}

/**
 * Normalizer for contractor jobs (property only, no room/tenant).
 */
export interface JobPropertyDisplay {
  propertyId: string;
  propertyAddress: string;
  propertyPostcode: string | null;
}

export function normalizeJobProperty(item: {
  property_id: string | null;
  property?: { id: string; address_line: string; postcode: string | null } | null;
  property_v2?: { id: string; address_line_1: string; city: string; postcode: string } | null;
}): JobPropertyDisplay {
  if (item.property_v2) {
    return {
      propertyId: item.property_v2.id,
      propertyAddress: `${item.property_v2.address_line_1}, ${item.property_v2.city}`,
      propertyPostcode: item.property_v2.postcode,
    };
  }
  return {
    propertyId: item.property_id || '',
    propertyAddress: item.property?.address_line || 'Unknown',
    propertyPostcode: item.property?.postcode || null,
  };
}
