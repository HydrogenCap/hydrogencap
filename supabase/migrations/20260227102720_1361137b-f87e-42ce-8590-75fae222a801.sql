ALTER TABLE public.tenancy_agreements DROP CONSTRAINT tenancy_agreements_deposit_scheme_check;

ALTER TABLE public.tenancy_agreements ADD CONSTRAINT tenancy_agreements_deposit_scheme_check CHECK (deposit_scheme IN ('DPS', 'MyDeposits', 'TDS', 'N/A', 'none'));