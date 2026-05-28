/**
 * AE2: Demo data seeding and clearing functions.
 * Seeds realistic UK property portfolio data tagged with '[DEMO]' prefix.
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DEMO_ENTITIES,
  DEMO_PROPERTIES,
  DEMO_ROOMS,
  DEMO_TENANTS,
  DEMO_LENDERS,
  DEMO_LOANS,
  DEMO_COMPLIANCE_REQS,
  DEMO_COMPLIANCE_DOCS,
  DEMO_VOIDS,
  DEMO_MAINTENANCE,
} from './demoData';

export async function seedDemoData(
  orgId: string,
  _userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Create legal entities
    const entityIds: string[] = [];
    for (const ent of DEMO_ENTITIES) {
      const { data, error } = await supabase
        .from('legal_entities')
        .insert({ ...ent, org_id: orgId })
        .select('id')
        .single();
      if (error) throw new Error(`Entity: ${error.message}`);
      entityIds.push(data.id);
    }

    // 2. Create properties
    const propertyIds: string[] = [];
    for (const prop of DEMO_PROPERTIES) {
      const { entity_index, ...rest } = prop;
      const { data, error } = await supabase
        .from('properties_v2')
        .insert({
          ...rest,
          org_id: orgId,
          entity_id: entityIds[entity_index],
        })
        .select('id')
        .single();
      if (error) throw new Error(`Property: ${error.message}`);
      propertyIds.push(data.id);
    }

    // 3. Create rooms
    const roomIdsByProperty: Record<number, string[]> = {};
    for (const room of DEMO_ROOMS) {
      const { property_index, ...rest } = room;
      const propId = propertyIds[property_index];
      const { data, error } = await supabase
        .from('rooms_v2')
        .insert({
          ...rest,
          property_id: propId,
          occupancy_status: rest.is_lettable ? 'vacant' : 'n_a',
        })
        .select('id')
        .single();
      if (error) throw new Error(`Room: ${error.message}`);
      if (!roomIdsByProperty[property_index]) roomIdsByProperty[property_index] = [];
      roomIdsByProperty[property_index].push(data.id);
    }

    // 4. Create tenants + tenancy agreements
    const tenantIds: string[] = [];
    const tenancyIds: string[] = [];
    for (const t of DEMO_TENANTS) {
      const { property_index, room_index, rent_amount_pcm, start_date, is_periodic, break_clause_date, ...tenantData } = t;
      
      // Create tenant
      const { data: tenant, error: tErr } = await supabase
        .from('tenants_v2')
        .insert({ ...tenantData, org_id: orgId, status: 'active', tenant_type: 'individual' })
        .select('id')
        .single();
      if (tErr) throw new Error(`Tenant: ${tErr.message}`);
      tenantIds.push(tenant.id);

      // Find the room ID
      const propertyRooms = roomIdsByProperty[property_index] || [];
      const roomId = propertyRooms[room_index];
      if (!roomId) throw new Error(`Room not found: prop=${property_index}, room=${room_index}`);

      // Mark room as occupied
      await supabase.from('rooms_v2').update({ occupancy_status: 'occupied', current_rent_pcm: rent_amount_pcm }).eq('id', roomId);

      // Create tenancy agreement
      const { data: tenancy, error: taErr } = await supabase
        .from('tenancy_agreements')
        .insert({
          org_id: orgId,
          property_id: propertyIds[property_index],
          room_id: roomId,
          tenant_id: tenant.id,
          rent_amount_pcm,
          start_date,
          status: 'active',
          tenancy_type: 'ast',
          rent_frequency: 'monthly',
          is_periodic: is_periodic || false,
          break_clause_date: break_clause_date || null,
          notes: '[DEMO]',
        })
        .select('id')
        .single();
      if (taErr) throw new Error(`Tenancy: ${taErr.message}`);
      tenancyIds.push(tenancy.id);
    }

    // 5. Create lenders
    const lenderIds: string[] = [];
    for (const lender of DEMO_LENDERS) {
      const { data, error } = await supabase
        .from('lenders')
        .insert({ ...lender, org_id: orgId })
        .select('id')
        .single();
      if (error) throw new Error(`Lender: ${error.message}`);
      lenderIds.push(data.id);
    }

    // 6. Create loan facilities
    for (const loan of DEMO_LOANS) {
      const { property_index, entity_index, lender_index, ...rest } = loan;
      const { error } = await supabase.from('loan_facilities').insert({
        ...rest,
        org_id: orgId,
        property_id: propertyIds[property_index],
        entity_id: entityIds[entity_index],
        lender_id: lenderIds[lender_index],
        status: 'active',
      });
      if (error) throw new Error(`Loan: ${error.message}`);
    }

    // 7. Create compliance requirements
    for (const req of DEMO_COMPLIANCE_REQS) {
      const { property_index, ...rest } = req;
      const { error } = await supabase.from('compliance_requirements').insert({
        ...rest,
        org_id: orgId,
        property_id: propertyIds[property_index],
      });
      if (error) throw new Error(`Compliance req: ${error.message}`);
    }

    // 8. Create compliance documents
    for (const doc of DEMO_COMPLIANCE_DOCS) {
      const { property_index, ...rest } = doc;
      const { error } = await supabase.from('compliance_documents_v2').insert({
        ...rest,
        org_id: orgId,
        property_id: propertyIds[property_index],
      });
      if (error) throw new Error(`Compliance doc: ${error.message}`);
    }

    // 9. Create void periods
    for (const v of DEMO_VOIDS) {
      const { property_index, room_index, ...rest } = v;
      const roomId = roomIdsByProperty[property_index]?.[room_index];
      const { error } = await supabase.from('void_periods').insert({
        ...rest,
        org_id: orgId,
        property_id: propertyIds[property_index],
        room_id: roomId || null,
      } as any);
      if (error) throw new Error(`Void: ${error.message}`);
    }

    // 10. Create maintenance requests
    for (const m of DEMO_MAINTENANCE) {
      const { property_index, ...rest } = m;
      const { error } = await supabase.from('maintenance_requests').insert({
        ...rest,
        org_id: orgId,
        property_v2_id: propertyIds[property_index],
        reported_by: 'Tenant',
      });
      if (error) throw new Error(`Maintenance: ${error.message}`);
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to seed demo data:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to seed demo data');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function clearDemoData(orgId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Find all demo property IDs
    const { data: demoProps } = await supabase
      .from('properties_v2')
      .select('id')
      .eq('org_id', orgId)
      .eq('is_demo', true);

    if (!demoProps || demoProps.length === 0) return { success: true };

    const propIds = demoProps.map((property) => property.id);

    // Delete in dependency order
    // Maintenance requests
    await supabase.from('maintenance_requests').delete().in('property_v2_id', propIds);
    // Void periods
    await supabase.from('void_periods').delete().in('property_id', propIds);
    // Compliance docs & reqs
    await supabase.from('compliance_documents_v2').delete().in('property_id', propIds);
    await supabase.from('compliance_requirements').delete().in('property_id', propIds);

    // Find rooms for these properties
    const { data: demoRooms } = await supabase.from('rooms_v2').select('id').in('property_id', propIds);
    const roomIds = demoRooms?.map((room) => room.id) || [];

    // Tenancy agreements (which reference rooms_v2)
    if (roomIds.length > 0) {
      // Find tenancy agreements
      const { data: demoTenancies } = await supabase
        .from('tenancy_agreements')
        .select('id, tenant_id')
        .in('room_id', roomIds);
      
      const tenancyAgreementIds = demoTenancies?.map((tenancy) => tenancy.id) || [];
      const tenantIds = [...new Set(demoTenancies?.map((tenancy) => tenancy.tenant_id) || [])];

      // Delete tenancy agreements
      if (tenancyAgreementIds.length > 0) {
        await supabase.from('tenancy_agreements').delete().in('id', tenancyAgreementIds);
      }

      // Delete demo tenants (those tagged with [DEMO])
      if (tenantIds.length > 0) {
        await supabase.from('tenants_v2').delete().in('id', tenantIds).ilike('notes', '%[DEMO]%');
      }
    }

    // Loan facilities
    await supabase.from('loan_facilities').delete().in('property_id', propIds);

    // Rooms
    await supabase.from('rooms_v2').delete().in('property_id', propIds);

    // Properties
    await supabase.from('properties_v2').delete().in('id', propIds);

    // Demo lenders (tagged with [DEMO])
    await supabase.from('lenders').delete().eq('org_id', orgId).ilike('notes', '%[DEMO]%');

    // Demo entities (tagged with [DEMO])
    await supabase.from('legal_entities').delete().eq('org_id', orgId).ilike('notes', '%[DEMO]%');

    return { success: true };
  } catch (error: unknown) {
    console.error('Failed to clear demo data:', error);
    toast.error(error instanceof Error ? error.message : 'Failed to clear demo data');
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
