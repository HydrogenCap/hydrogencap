
-- Fix security definer view by setting it to SECURITY INVOKER
ALTER VIEW public.property_room_summary_v2 SET (security_invoker = on);
