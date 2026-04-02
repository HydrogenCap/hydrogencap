import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  checkHMOCompliance,
  isHMOProperty,
  type RoomData,
  type PropertyData,
  type HMOComplianceResult,
} from '@/lib/hmo-compliance';

interface RoomRow {
  id: string;
  room_name: string;
  room_type: string;
  is_lettable: boolean;
  size_sqm: number | null;
  occupancy_type: string | null;
  amenity_type: string | null;
}

function toRoomData(row: RoomRow): RoomData {
  return {
    id: row.id,
    room_name: row.room_name,
    size_sqm: row.size_sqm,
    occupancy_type: row.occupancy_type as RoomData['occupancy_type'],
    amenity_type: row.amenity_type as RoomData['amenity_type'],
    room_type: row.room_type,
    is_lettable: row.is_lettable,
  };
}

export function useHMOCompliance(propertyId: string | undefined, propertyType: string | undefined) {
  const isHMO = propertyType ? isHMOProperty(propertyType) : false;

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['hmo_rooms', propertyId],
    queryFn: async () => {
      if (!propertyId) return [];
      const { data, error } = await supabase
        .from('rooms_v2')
        .select('id, room_name, room_type, is_lettable, size_sqm, occupancy_type, amenity_type')
        .eq('property_id', propertyId)
        .order('room_name');
      if (error) throw error;
      return (data as RoomRow[]).map(toRoomData);
    },
    enabled: !!propertyId && isHMO,
  });

  const result = useMemo<HMOComplianceResult | null>(() => {
    if (!propertyId || !isHMO || !rooms) return null;
    const property: PropertyData = { id: propertyId, property_type: propertyType! };
    return checkHMOCompliance(property, rooms);
  }, [propertyId, propertyType, isHMO, rooms]);

  return { data: result, isLoading, isHMO };
}

export interface PortfolioHMOItem {
  propertyId: string;
  address: string;
  compliance: HMOComplianceResult;
}

export function useHMOPortfolioCompliance() {
  return useQuery({
    queryKey: ['hmo_portfolio_compliance'],
    queryFn: async () => {
      // Fetch all HMO properties
      const { data: properties, error: propError } = await supabase
        .from('properties_v2')
        .select('id, property_type, address_line_1, city, postcode')
        .in('property_type', ['hmo_licensed', 'hmo_mandatory'])
        .order('address_line_1');
      if (propError) throw propError;
      if (!properties || properties.length === 0) return [];

      const propertyIds = properties.map(p => p.id);

      // Fetch all rooms for HMO properties
      const { data: allRooms, error: roomError } = await supabase
        .from('rooms_v2')
        .select('id, property_id, room_name, room_type, is_lettable, size_sqm, occupancy_type, amenity_type')
        .in('property_id', propertyIds)
        .order('room_name');
      if (roomError) throw roomError;

      // Group rooms by property
      const roomsByProperty = new Map<string, RoomData[]>();
      for (const row of (allRooms || []) as (RoomRow & { property_id: string })[]) {
        const list = roomsByProperty.get(row.property_id) || [];
        list.push(toRoomData(row));
        roomsByProperty.set(row.property_id, list);
      }

      // Run compliance check for each property
      const results: PortfolioHMOItem[] = properties.map(p => {
        const rooms = roomsByProperty.get(p.id) || [];
        const compliance = checkHMOCompliance(
          { id: p.id, property_type: p.property_type },
          rooms,
        );
        return {
          propertyId: p.id,
          address: [p.address_line_1, p.city, p.postcode].filter(Boolean).join(', '),
          compliance,
        };
      });

      return results;
    },
  });
}
