-- Realtime authorization: lock down private channels by topic.
-- Topics use the schema:
--   subscription:user:{user_id}
--   inbox:org:{org_id}
--   ownership:company:{company_id}
--   ownership:property:{property_id}
--   entity:{entity_id}:{table_name}
--
-- A SECURITY DEFINER helper parses the topic and checks org membership
-- via the existing public.user_has_org_access(org_id) function. The
-- policy on realtime.messages restricts SELECT (subscription delivery)
-- to topics the caller is authorised for.

CREATE OR REPLACE FUNCTION public.realtime_topic_authorized(_topic text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR _topic IS NULL THEN
    RETURN false;
  END IF;

  parts := string_to_array(_topic, ':');
  IF array_length(parts, 1) < 3 THEN
    RETURN false;
  END IF;

  -- subscription:user:{user_id}
  IF parts[1] = 'subscription' AND parts[2] = 'user' THEN
    RETURN parts[3]::uuid = uid;
  END IF;

  -- inbox:org:{org_id}
  IF parts[1] = 'inbox' AND parts[2] = 'org' THEN
    RETURN public.user_has_org_access(parts[3]::uuid);
  END IF;

  -- ownership:company:{company_id}
  IF parts[1] = 'ownership' AND parts[2] = 'company' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.companies c
      WHERE c.id = parts[3]::uuid
        AND public.user_has_org_access(c.org_id)
    );
  END IF;

  -- ownership:property:{property_id}
  IF parts[1] = 'ownership' AND parts[2] = 'property' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.properties_v2 p
      WHERE p.id = parts[3]::uuid
        AND public.user_has_org_access(p.org_id)
    );
  END IF;

  -- entity:{entity_id}:{table_name}
  IF parts[1] = 'entity' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.legal_entities le
      WHERE le.id = parts[2]::uuid
        AND public.user_has_org_access(le.org_id)
    );
  END IF;

  RETURN false;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.realtime_topic_authorized(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realtime_topic_authorized(text) TO authenticated, service_role;

-- Policies on realtime.messages: only deliver messages on topics the caller
-- is authorised for. realtime.topic() returns the current channel's topic.
DROP POLICY IF EXISTS "Authenticated can read authorised topics" ON realtime.messages;
CREATE POLICY "Authenticated can read authorised topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.realtime_topic_authorized((SELECT realtime.topic())));

-- Allow authenticated to broadcast/presence-write on the same authorised topics.
DROP POLICY IF EXISTS "Authenticated can write authorised topics" ON realtime.messages;
CREATE POLICY "Authenticated can write authorised topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.realtime_topic_authorized((SELECT realtime.topic())));