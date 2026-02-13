-- Add missing document categories for PAT Testing, Legionella, and MCS
INSERT INTO document_categories (name, slug, description, icon, entity_type, is_system, display_order)
VALUES 
  ('PAT Testing', 'pat-testing', 'Portable Appliance Testing certificates', 'Zap', 'property', true, 25),
  ('Legionella', 'legionella', 'Legionella risk assessments', 'Droplets', 'property', true, 26),
  ('MCS Certificate', 'mcs-certificate', 'Microgeneration Certification Scheme certificates', 'Award', 'property', true, 27)
ON CONFLICT DO NOTHING;