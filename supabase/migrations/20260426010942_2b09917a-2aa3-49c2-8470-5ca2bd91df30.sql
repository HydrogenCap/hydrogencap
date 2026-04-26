-- Section C.3 of docs/release/rls-audit-2026-04-26.md
-- Tighten INSERT policy on public.notifications to prevent cross-user notification spoofing.

-- Step 1: Drop the overly permissive existing policy
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

-- Step 2: Authenticated users may only insert notifications addressed to themselves
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Step 3: Service role retains ability to insert cross-user system notifications
-- (used by SECURITY DEFINER triggers and edge functions)
DROP POLICY IF EXISTS "Service can insert system notifications" ON public.notifications;
CREATE POLICY "Service can insert system notifications"
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);
