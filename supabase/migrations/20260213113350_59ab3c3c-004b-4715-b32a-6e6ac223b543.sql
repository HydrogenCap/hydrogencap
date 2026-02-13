
-- Add unique constraint on slug if not exists
ALTER TABLE document_categories ADD CONSTRAINT document_categories_slug_key UNIQUE (slug);

-- Seed/update document categories for property portfolio management
INSERT INTO document_categories (id, name, slug, description, icon, color, entity_type, display_order, is_system)
VALUES
  -- Legal
  (gen_random_uuid(), 'Legal Pack',         'legal-pack',         'Title deeds, land registry, searches, leases',                      'Scale',         'purple',  'all', 10, true),
  (gen_random_uuid(), 'Contracts',          'contracts',          'Purchase contracts, sale agreements, option agreements',              'FileSignature', 'purple',  'all', 11, true),
  (gen_random_uuid(), 'Licences & Permits', 'licences-permits',   'HMO licences, planning permissions, building control sign-offs',     'BadgeCheck',    'purple',  'all', 12, true),

  -- Financial
  (gen_random_uuid(), 'Mortgage Offers',    'mortgage-offers',    'Mortgage offer letters, KFIs, redemption statements',                'Landmark',      'blue',    'all', 20, true),
  (gen_random_uuid(), 'Valuations',         'valuations',         'Property valuations, surveyor reports, RICS red book',               'TrendingUp',    'blue',    'all', 21, true),
  (gen_random_uuid(), 'Insurance',          'insurance',          'Buildings insurance, landlord insurance, rent guarantee',             'ShieldCheck',   'blue',    'all', 22, true),
  (gen_random_uuid(), 'Tax & Accounts',     'tax-accounts',       'Tax returns, company accounts, VAT returns, P&L statements',         'Calculator',    'blue',    'all', 23, true),
  (gen_random_uuid(), 'Invoices & Receipts','invoices-receipts',  'Contractor invoices, purchase receipts, service charge demands',      'Receipt',       'blue',    'all', 24, true),

  -- Property
  (gen_random_uuid(), 'Surveys',            'surveys',            'Homebuyer reports, building surveys, structural surveys',             'ClipboardList', 'green',   'all', 30, true),
  (gen_random_uuid(), 'Floor Plans',        'floor-plans',        'Floor plans, site plans, room layouts',                              'LayoutDashboard','green',  'all', 31, true),
  (gen_random_uuid(), 'Photos',             'photos',             'Property photos, condition reports, before/after',                    'Camera',        'green',   'all', 32, true),
  (gen_random_uuid(), 'Inventories',        'inventories',        'Check-in/check-out inventories, room contents schedules',             'ClipboardCheck','green',   'all', 33, true),

  -- Tenancy
  (gen_random_uuid(), 'Tenancy Agreements', 'tenancy-agreements', 'ASTs, lodger agreements, licence to occupy',                         'Users',         'amber',   'all', 40, true),
  (gen_random_uuid(), 'Tenant References',  'tenant-references',  'Credit checks, employer references, landlord references',             'UserCheck',     'amber',   'all', 41, true),
  (gen_random_uuid(), 'Rent Statements',    'rent-statements',    'Rent schedules, payment histories, arrears letters',                  'PoundSterling', 'amber',   'all', 42, true),

  -- Company
  (gen_random_uuid(), 'Board Minutes',      'board-minutes',      'Board meeting minutes, resolutions, written resolutions',             'BookOpen',      'slate',   'all', 50, true),
  (gen_random_uuid(), 'Share Certificates', 'share-certificates', 'Share certificates, stock transfer forms, SH01 returns',              'Award',         'slate',   'all', 51, true),
  (gen_random_uuid(), 'Company Formation',  'company-formation',  'Articles of association, certificates of incorporation, MOUs',         'Building2',     'slate',   'all', 52, true),

  -- General
  (gen_random_uuid(), 'Correspondence',     'correspondence',     'Letters, emails, notices from councils, lenders, agents',              'Mail',          'gray',    'all', 60, true),
  (gen_random_uuid(), 'Other',              'other',              'Miscellaneous documents',                                             'File',          'gray',    'all', 99, true)

ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  display_order = EXCLUDED.display_order;
