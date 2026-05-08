-- #54b: drop public.tenancies. Pre-flight on 2026-05-08 confirmed:
--   v1_freeze_guard active, 0 FKs, 0 views, 0 function/policy refs (cleared by precursor), 13 stale rows.
DROP TRIGGER IF EXISTS v1_freeze_guard ON public.tenancies;
DROP TABLE public.tenancies;