-- Allow inserting notifications targeted at any member of an org you belong to.
-- Cross-org targeting is still blocked because both org_id and target user_id
-- must be tied to the same org.
CREATE POLICY "Org members can insert notifications for teammates"
ON public.notifications
FOR INSERT
WITH CHECK (
  public.user_has_org_access(org_id)
  AND EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = notifications.org_id
      AND m.user_id = notifications.user_id
  )
);
