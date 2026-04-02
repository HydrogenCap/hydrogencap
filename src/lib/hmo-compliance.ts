/**
 * UK HMO Room Compliance Checker
 * Based on The Licensing of Houses in Multiple Occupation (Mandatory Conditions of Licences) (England) Order 2018
 *
 * Minimum bedroom sizes:
 *  - Single adult occupancy: 6.51 sq m
 *  - Double/couple occupancy: 10.22 sq m
 *  - Child under 10 occupancy: 4.64 sq m
 *
 * Amenity ratios:
 *  - 1 bathroom per 5 occupants
 *  - 1 kitchen per 7 occupants (shared cooking facilities)
 *  - 1 toilet per 5 occupants
 */

export const HMO_ROOM_MINIMUMS = {
  single_adult: 6.51,
  double_adult: 10.22,
  child_under_10: 4.64,
} as const;

export const HMO_AMENITY_RATIOS = {
  bathroom_per_occupants: 5,
  kitchen_per_occupants: 7,
  toilet_per_occupants: 5,
} as const;

export type OccupancyType = 'single' | 'double' | 'child';
export type AmenityType = 'bedroom' | 'bathroom' | 'kitchen' | 'toilet' | 'common';

export interface RoomData {
  id: string;
  room_name: string;
  size_sqm: number | null;
  occupancy_type: OccupancyType | null;
  amenity_type: AmenityType | null;
  room_type: string;
  is_lettable: boolean;
}

export interface PropertyData {
  id: string;
  property_type: string;
}

export interface RoomComplianceResult {
  roomId: string;
  roomName: string;
  sizeSqm: number;
  occupancy: OccupancyType;
  minimumRequired: number;
  isCompliant: boolean;
  shortfall: number;
}

export interface AmenityResult {
  bathroomsRequired: number;
  bathroomsActual: number;
  bathroomCompliant: boolean;
  kitchensRequired: number;
  kitchensActual: number;
  kitchenCompliant: boolean;
  toiletsRequired: number;
  toiletsActual: number;
  toiletCompliant: boolean;
}

export interface HMOComplianceResult {
  propertyId: string;
  totalOccupants: number;
  totalBathrooms: number;
  totalKitchens: number;
  totalToilets: number;
  roomResults: RoomComplianceResult[];
  amenityResults: AmenityResult;
  overallCompliant: boolean;
  issues: string[];
  licenceConditions: string[];
}

function getMinimumSize(occupancy: OccupancyType): number {
  switch (occupancy) {
    case 'single': return HMO_ROOM_MINIMUMS.single_adult;
    case 'double': return HMO_ROOM_MINIMUMS.double_adult;
    case 'child': return HMO_ROOM_MINIMUMS.child_under_10;
  }
}

function getOccupantCount(occupancy: OccupancyType): number {
  return occupancy === 'double' ? 2 : 1;
}

function getOccupancyLabel(occupancy: OccupancyType): string {
  switch (occupancy) {
    case 'single': return 'single adult';
    case 'double': return 'double/couple';
    case 'child': return 'child under 10';
  }
}

export function checkHMOCompliance(property: PropertyData, rooms: RoomData[]): HMOComplianceResult {
  const issues: string[] = [];
  const roomResults: RoomComplianceResult[] = [];

  // Separate bedrooms from amenity rooms
  const bedrooms = rooms.filter(r => r.amenity_type === 'bedroom' || (!r.amenity_type && r.is_lettable));
  const bathrooms = rooms.filter(r => r.amenity_type === 'bathroom');
  const kitchens = rooms.filter(r => r.amenity_type === 'kitchen');
  const toilets = rooms.filter(r => r.amenity_type === 'toilet');

  // Check each bedroom for size compliance
  for (const room of bedrooms) {
    const occupancy = room.occupancy_type || (room.room_type === 'double' ? 'double' : 'single');
    const minimumRequired = getMinimumSize(occupancy);

    if (room.size_sqm == null) {
      issues.push(`${room.room_name}: room size not recorded — cannot verify compliance`);
      roomResults.push({
        roomId: room.id,
        roomName: room.room_name,
        sizeSqm: 0,
        occupancy,
        minimumRequired,
        isCompliant: false,
        shortfall: minimumRequired,
      });
      continue;
    }

    const shortfall = Math.max(0, minimumRequired - room.size_sqm);
    const isCompliant = room.size_sqm >= minimumRequired;

    if (!isCompliant) {
      issues.push(
        `${room.room_name}: ${room.size_sqm.toFixed(2)} m² is below the ${minimumRequired} m² minimum for ${getOccupancyLabel(occupancy)} occupancy (short by ${shortfall.toFixed(2)} m²)`
      );
    }

    roomResults.push({
      roomId: room.id,
      roomName: room.room_name,
      sizeSqm: room.size_sqm,
      occupancy,
      minimumRequired,
      isCompliant,
      shortfall,
    });
  }

  // Calculate total occupants
  const totalOccupants = bedrooms.reduce((sum, room) => {
    const occupancy = room.occupancy_type || (room.room_type === 'double' ? 'double' : 'single');
    return sum + getOccupantCount(occupancy);
  }, 0);

  // Calculate required amenities
  const bathroomsRequired = Math.ceil(totalOccupants / HMO_AMENITY_RATIOS.bathroom_per_occupants);
  const kitchensRequired = Math.ceil(totalOccupants / HMO_AMENITY_RATIOS.kitchen_per_occupants);
  const toiletsRequired = Math.ceil(totalOccupants / HMO_AMENITY_RATIOS.toilet_per_occupants);

  const bathroomCompliant = bathrooms.length >= bathroomsRequired;
  const kitchenCompliant = kitchens.length >= kitchensRequired;
  const toiletCompliant = toilets.length >= toiletsRequired;

  if (!bathroomCompliant) {
    issues.push(
      `Insufficient bathrooms: ${bathrooms.length} provided, ${bathroomsRequired} required (1 per ${HMO_AMENITY_RATIOS.bathroom_per_occupants} occupants, ${totalOccupants} total occupants)`
    );
  }
  if (!kitchenCompliant) {
    issues.push(
      `Insufficient kitchens: ${kitchens.length} provided, ${kitchensRequired} required (1 per ${HMO_AMENITY_RATIOS.kitchen_per_occupants} occupants, ${totalOccupants} total occupants)`
    );
  }
  if (!toiletCompliant) {
    issues.push(
      `Insufficient toilets: ${toilets.length} provided, ${toiletsRequired} required (1 per ${HMO_AMENITY_RATIOS.toilet_per_occupants} occupants, ${totalOccupants} total occupants)`
    );
  }

  const amenityResults: AmenityResult = {
    bathroomsRequired,
    bathroomsActual: bathrooms.length,
    bathroomCompliant,
    kitchensRequired,
    kitchensActual: kitchens.length,
    kitchenCompliant,
    toiletsRequired,
    toiletsActual: toilets.length,
    toiletCompliant,
  };

  const allRoomsCompliant = roomResults.every(r => r.isCompliant);
  const allAmenitiesCompliant = bathroomCompliant && kitchenCompliant && toiletCompliant;
  const overallCompliant = allRoomsCompliant && allAmenitiesCompliant;

  // Standard HMO licence conditions
  const licenceConditions = [
    'Annual gas safety certificate must be provided to the council',
    'Electrical installations must be inspected at least every 5 years',
    'Smoke alarms must be installed on each storey and tested annually',
    'Carbon monoxide alarms required in rooms with solid fuel appliances',
    'Fire escape routes must be kept clear at all times',
    'Common areas and shared facilities must be maintained in good repair',
    'Adequate rubbish disposal facilities must be provided',
    'The licence holder must be a fit and proper person',
  ];

  return {
    propertyId: property.id,
    totalOccupants,
    totalBathrooms: bathrooms.length,
    totalKitchens: kitchens.length,
    totalToilets: toilets.length,
    roomResults,
    amenityResults,
    overallCompliant,
    issues,
    licenceConditions,
  };
}

export function isHMOProperty(propertyType: string): boolean {
  return propertyType === 'hmo_licensed' || propertyType === 'hmo_mandatory';
}
