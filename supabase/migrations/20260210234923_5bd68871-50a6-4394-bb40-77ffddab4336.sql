CREATE INDEX IF NOT EXISTS idx_rent_schedule_status_due 
ON rent_schedule(status, due_date);

CREATE INDEX IF NOT EXISTS idx_rent_schedule_tenancy_due 
ON rent_schedule(tenancy_id, due_date);

CREATE INDEX IF NOT EXISTS idx_rent_payments_tenancy_date 
ON rent_payments(tenancy_id, payment_date);