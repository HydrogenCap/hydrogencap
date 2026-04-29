-- Stage A.1 of Supabase lint hardening (2026-04-29)
-- Bucket: Function Search Path Mutable (lint=0011)
-- Mechanically pin search_path on every public function that lacks it.
-- Behaviour-preserving; eliminates schema-injection risk.
-- Idempotent: ALTER FUNCTION ... SET is safe to re-run.

ALTER FUNCTION public.prevent_locked_snapshot_update() SET search_path = public, pg_temp;
ALTER FUNCTION public.v1_freeze_guard() SET search_path = public, pg_temp;