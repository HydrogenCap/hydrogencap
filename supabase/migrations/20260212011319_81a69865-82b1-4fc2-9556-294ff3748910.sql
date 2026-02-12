
-- Create has_role helper function for RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.memberships
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create get_user_role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid, _org_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.memberships
  WHERE user_id = _user_id
    AND org_id = _org_id
  LIMIT 1
$$;

-- Create onboarding_completed column on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- RLS policy: only owners can update memberships (manage roles)
CREATE POLICY "Owners can update membership roles"
ON public.memberships
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = memberships.org_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = memberships.org_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
  )
);

-- RLS policy: only owners can delete memberships (remove members)  
CREATE POLICY "Owners can delete memberships"
ON public.memberships
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = memberships.org_id
    AND m.user_id = auth.uid()
    AND m.role = 'owner'
  )
);

-- RLS policy: only owners/admins can insert memberships (invite members)
CREATE POLICY "Owners and admins can insert memberships"
ON public.memberships
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.org_id = memberships.org_id
    AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  )
  OR auth.uid() = user_id -- allow self-insert during signup
);
