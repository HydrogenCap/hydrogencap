ALTER TABLE public.tenancies DROP CONSTRAINT tenancies_rent_due_day_check;
ALTER TABLE public.tenancies ADD CONSTRAINT tenancies_rent_due_day_check CHECK (rent_due_day >= 1 AND rent_due_day <= 31);