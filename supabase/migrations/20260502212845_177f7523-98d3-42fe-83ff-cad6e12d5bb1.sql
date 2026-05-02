BEGIN;

-- Build property_id remap bridge (V1 -> V2)
CREATE TEMP TABLE tmp_property_id_remap (v1_id uuid PRIMARY KEY, v2_id uuid NOT NULL, match_strategy text NOT NULL) ON COMMIT DROP;

-- Strategy 1: exact address_line + postcode (case/whitespace insensitive)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2.id, 'exact_address_postcode'
FROM properties v1
JOIN properties_v2 v2
  ON lower(trim(v1.address_line)) = lower(trim(v2.address_line_1))
 AND lower(trim(v1.postcode)) = lower(trim(v2.postcode))
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy 2: postcode + leading house number fuzzy (covers '25 Arle Gardens, Cheltenham' -> '25 Arle Gardens')
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2.id, 'postcode_leading_number'
FROM properties v1
JOIN properties_v2 v2
  ON lower(trim(v1.postcode)) = lower(trim(v2.postcode))
 AND substring(trim(v1.address_line) from '^[0-9]+') IS NOT NULL
 AND substring(trim(v1.address_line) from '^[0-9]+') = substring(trim(v2.address_line_1) from '^[0-9]+')
WHERE v1.id NOT IN (SELECT v1_id FROM tmp_property_id_remap)
ON CONFLICT (v1_id) DO NOTHING;

-- Strategy 3: identity (for the 24 West Street shadow row, which already shares an id)
INSERT INTO tmp_property_id_remap (v1_id, v2_id, match_strategy)
SELECT v1.id, v2.id, 'identity'
FROM properties v1 JOIN properties_v2 v2 ON v1.id = v2.id
WHERE v1.id NOT IN (SELECT v1_id FROM tmp_property_id_remap)
ON CONFLICT (v1_id) DO NOTHING;

-- Pre-flight: assert no drift row will be left unmapped
DO $$
DECLARE missing int;
BEGIN
  SELECT COUNT(*) INTO missing FROM (
    SELECT property_id AS pid FROM documents WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT ai_suggested_property_id FROM documents WHERE ai_suggested_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=ai_suggested_property_id)
    UNION ALL SELECT property_id FROM photos WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT property_id FROM property_beneficial_owners WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT property_id FROM property_legal_ownership WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
  ) d WHERE pid NOT IN (SELECT v1_id FROM tmp_property_id_remap);
  IF missing > 0 THEN
    RAISE EXCEPTION 'Unmapped drift rows: %', missing;
  END IF;
END $$;

-- ===== documents.property_id (SET NULL) =====
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_property_id_fkey;
UPDATE public.documents d SET property_id = r.v2_id FROM tmp_property_id_remap r WHERE d.property_id = r.v1_id;
ALTER TABLE public.documents ADD CONSTRAINT documents_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE SET NULL;

-- ===== documents.ai_suggested_property_id (SET NULL) =====
ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_ai_suggested_property_id_fkey;
UPDATE public.documents d SET ai_suggested_property_id = r.v2_id FROM tmp_property_id_remap r WHERE d.ai_suggested_property_id = r.v1_id;
ALTER TABLE public.documents ADD CONSTRAINT documents_ai_suggested_property_id_fkey
  FOREIGN KEY (ai_suggested_property_id) REFERENCES public.properties_v2(id) ON DELETE SET NULL;

-- ===== photos.property_id (CASCADE) — drop policies, swap, recreate =====
DROP POLICY IF EXISTS "Shareholders can view photos" ON public.photos;
DROP POLICY IF EXISTS "Users can delete photos for their properties" ON public.photos;
DROP POLICY IF EXISTS "Users can insert photos for their properties" ON public.photos;
DROP POLICY IF EXISTS "Users can update photos for their properties" ON public.photos;
DROP POLICY IF EXISTS "Users can view photos for their properties" ON public.photos;

ALTER TABLE public.photos DROP CONSTRAINT IF EXISTS photos_property_id_fkey;
UPDATE public.photos p SET property_id = r.v2_id FROM tmp_property_id_remap r WHERE p.property_id = r.v1_id;
ALTER TABLE public.photos ADD CONSTRAINT photos_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

CREATE POLICY "Shareholders can view photos" ON public.photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = photos.property_id AND user_has_shareholder_access(p.org_id)));
CREATE POLICY "Users can view photos for their properties" ON public.photos FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = photos.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can insert photos for their properties" ON public.photos FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = photos.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can update photos for their properties" ON public.photos FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = photos.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can delete photos for their properties" ON public.photos FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = photos.property_id AND user_has_org_access(p.org_id)));

-- ===== property_beneficial_owners.property_id (CASCADE) =====
DROP POLICY IF EXISTS "Users can delete beneficial owners for their properties" ON public.property_beneficial_owners;
DROP POLICY IF EXISTS "Users can insert beneficial owners for their properties" ON public.property_beneficial_owners;
DROP POLICY IF EXISTS "Users can update beneficial owners for their properties" ON public.property_beneficial_owners;
DROP POLICY IF EXISTS "Users can view beneficial owners for their properties" ON public.property_beneficial_owners;

ALTER TABLE public.property_beneficial_owners DROP CONSTRAINT IF EXISTS property_beneficial_owners_property_id_fkey;
UPDATE public.property_beneficial_owners x SET property_id = r.v2_id FROM tmp_property_id_remap r WHERE x.property_id = r.v1_id;
ALTER TABLE public.property_beneficial_owners ADD CONSTRAINT property_beneficial_owners_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

CREATE POLICY "Users can view beneficial owners for their properties" ON public.property_beneficial_owners FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_beneficial_owners.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can insert beneficial owners for their properties" ON public.property_beneficial_owners FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_beneficial_owners.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can update beneficial owners for their properties" ON public.property_beneficial_owners FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_beneficial_owners.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can delete beneficial owners for their properties" ON public.property_beneficial_owners FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_beneficial_owners.property_id AND user_has_org_access(p.org_id)));

-- ===== property_legal_ownership.property_id (CASCADE) =====
DROP POLICY IF EXISTS "Users can delete legal ownership for their properties" ON public.property_legal_ownership;
DROP POLICY IF EXISTS "Users can insert legal ownership for their properties" ON public.property_legal_ownership;
DROP POLICY IF EXISTS "Users can update legal ownership for their properties" ON public.property_legal_ownership;
DROP POLICY IF EXISTS "Users can view legal ownership for their properties" ON public.property_legal_ownership;

ALTER TABLE public.property_legal_ownership DROP CONSTRAINT IF EXISTS property_legal_ownership_property_id_fkey;
UPDATE public.property_legal_ownership x SET property_id = r.v2_id FROM tmp_property_id_remap r WHERE x.property_id = r.v1_id;
ALTER TABLE public.property_legal_ownership ADD CONSTRAINT property_legal_ownership_property_id_fkey
  FOREIGN KEY (property_id) REFERENCES public.properties_v2(id) ON DELETE CASCADE;

CREATE POLICY "Users can view legal ownership for their properties" ON public.property_legal_ownership FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_legal_ownership.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can insert legal ownership for their properties" ON public.property_legal_ownership FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_legal_ownership.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can update legal ownership for their properties" ON public.property_legal_ownership FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_legal_ownership.property_id AND user_has_org_access(p.org_id)));
CREATE POLICY "Users can delete legal ownership for their properties" ON public.property_legal_ownership FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.properties_v2 p WHERE p.id = property_legal_ownership.property_id AND user_has_org_access(p.org_id)));

-- Post-flight assertion: zero drift across all 5 FKs
DO $$
DECLARE remaining int;
BEGIN
  SELECT COUNT(*) INTO remaining FROM (
    SELECT 1 FROM documents WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT 1 FROM documents WHERE ai_suggested_property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=ai_suggested_property_id)
    UNION ALL SELECT 1 FROM photos WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT 1 FROM property_beneficial_owners WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
    UNION ALL SELECT 1 FROM property_legal_ownership WHERE property_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM properties_v2 v WHERE v.id=property_id)
  ) d;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Post-flight drift remaining: %', remaining;
  END IF;
END $$;

COMMIT;