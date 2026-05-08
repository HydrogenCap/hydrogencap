
-- #48: Drop V1 public.loans after #45 (client freeze) + #47 (DB trigger freeze) soak.
-- Bare DROP (no CASCADE) — pre-flight confirmed 0 FKs and 0 view refs.
DROP TRIGGER IF EXISTS v1_freeze_guard ON public.loans;
DROP TABLE public.loans;
