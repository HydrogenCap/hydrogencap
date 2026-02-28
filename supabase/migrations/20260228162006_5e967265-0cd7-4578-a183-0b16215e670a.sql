
-- Add cost tracking columns to maintenance_requests
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS estimated_cost NUMERIC;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS actual_cost NUMERIC;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS cost_approved_by UUID;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS cost_approved_at TIMESTAMPTZ;
ALTER TABLE maintenance_requests ADD COLUMN IF NOT EXISTS invoice_reference TEXT;

-- Create maintenance-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-photos', 'maintenance-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for maintenance-photos bucket
CREATE POLICY "Authenticated users can upload maintenance photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated users can view maintenance photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'maintenance-photos');

CREATE POLICY "Authenticated users can delete maintenance photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-photos');
