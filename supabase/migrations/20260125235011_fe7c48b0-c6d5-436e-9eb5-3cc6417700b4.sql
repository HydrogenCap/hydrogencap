-- Fix function search paths for security
ALTER FUNCTION public.validate_ownership_total() SET search_path = public;
ALTER FUNCTION public.update_ownership_links_updated_at() SET search_path = public;