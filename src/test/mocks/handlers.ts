import { http, HttpResponse } from 'msw';

const SUPABASE_URL = 'https://jnkwooocjpgpznittueo.supabase.co';

const mockProperties = [
  {
    id: 'prop-1',
    org_id: 'org-1',
    address_line: '10 High Street',
    postcode: 'OX1 1AA',
    town_city: 'Oxford',
    area_name: 'City Centre',
    current_value_gbp: 350000,
    purchase_price_gbp: 280000,
    monthly_rent_gbp: 1200,
    bedrooms: 3,
    property_type: 'Terraced',
    lifecycle_type: 'buy_to_let',
    has_gas_supply: true,
    is_listed_building: false,
    is_hmo: false,
    created_at: '2025-12-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
    loans: [],
    income: [],
    costs: [],
    tenancies: [],
  },
  {
    id: 'prop-2',
    org_id: 'org-1',
    address_line: '5 Low Road',
    postcode: 'OX2 2BB',
    town_city: 'Witney',
    area_name: 'West Oxfordshire',
    current_value_gbp: 250000,
    purchase_price_gbp: 200000,
    monthly_rent_gbp: 900,
    bedrooms: 2,
    property_type: 'Semi-Detached',
    lifecycle_type: 'buy_to_let',
    has_gas_supply: false,
    is_listed_building: true,
    is_hmo: false,
    created_at: '2025-11-01T00:00:00Z',
    updated_at: '2026-01-10T00:00:00Z',
    loans: [],
    income: [],
    costs: [],
    tenancies: [],
  },
];

const mockMemberships = [
  { id: 'mem-1', user_id: 'user-1', org_id: 'org-1', role: 'owner' },
];

const mockComplianceItems = [
  {
    id: 'comp-1',
    property_id: 'prop-1',
    org_id: 'org-1',
    compliance_type: 'Gas Safety Certificate (CP12)',
    issue_date: '2025-06-01',
    expiry_date: '2026-06-01',
    status: 'valid',
    certificate_number: 'GS-001',
    notes: null,
    document_url: null,
    created_at: '2025-06-01T00:00:00Z',
    updated_at: '2025-06-01T00:00:00Z',
  },
];

export const handlers = [
  // Auth
  http.get(`${SUPABASE_URL}/auth/v1/user`, () => {
    return HttpResponse.json({
      id: 'user-1',
      email: 'test@hydrogencap.com',
      email_confirmed_at: '2025-01-01T00:00:00Z',
    });
  }),

  // Auth session (getSession)
  http.get(`${SUPABASE_URL}/auth/v1/token*`, () => {
    return HttpResponse.json({
      access_token: 'fake-token',
      token_type: 'bearer',
      expires_in: 3600,
      refresh_token: 'fake-refresh',
      user: {
        id: 'user-1',
        email: 'test@hydrogencap.com',
      },
    });
  }),

  // Memberships (getUserOrgId)
  http.get(`${SUPABASE_URL}/rest/v1/memberships*`, () => {
    return HttpResponse.json(mockMemberships);
  }),

  // Properties (with nested relations via select=*,loans(*),...)
  http.get(`${SUPABASE_URL}/rest/v1/properties*`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (id) {
      const cleanId = id.replace('eq.', '');
      const prop = mockProperties.find(p => p.id === cleanId);
      return HttpResponse.json(prop ? [prop] : []);
    }
    return HttpResponse.json(mockProperties);
  }),

  // Compliance items
  http.get(`${SUPABASE_URL}/rest/v1/compliance_items*`, () => {
    return HttpResponse.json(mockComplianceItems);
  }),

  // Insert catch-all
  http.post(`${SUPABASE_URL}/rest/v1/*`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json([{ id: 'new-id', ...(body as object) }], { status: 201 });
  }),

  // Update catch-all
  http.patch(`${SUPABASE_URL}/rest/v1/*`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json([body]);
  }),

  // Delete catch-all
  http.delete(`${SUPABASE_URL}/rest/v1/*`, () => {
    return HttpResponse.json([]);
  }),

  // Storage
  http.post(`${SUPABASE_URL}/storage/v1/object/*`, () => {
    return HttpResponse.json({ Key: 'test-file.pdf' });
  }),
];
