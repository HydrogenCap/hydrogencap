-- Fix missing ON DELETE action on properties_v2 FK columns.
-- Without this, deleting a company or party leaves orphaned properties_v2 rows
-- with dangling references, causing referential integrity violations.
-- Using SET NULL to preserve the property record when the legal owner is deleted.

DO $$
BEGIN
  -- legal_owner_company_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'properties_v2'
      AND kcu.column_name = 'legal_owner_company_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.properties_v2
      DROP CONSTRAINT IF EXISTS properties_v2_legal_owner_company_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties_v2' AND column_name = 'legal_owner_company_id'
  ) THEN
    ALTER TABLE public.properties_v2
      ADD CONSTRAINT properties_v2_legal_owner_company_id_fkey
      FOREIGN KEY (legal_owner_company_id)
      REFERENCES public.companies(id)
      ON DELETE SET NULL;
  END IF;

  -- legal_owner_party_id FK
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'properties_v2'
      AND kcu.column_name = 'legal_owner_party_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE public.properties_v2
      DROP CONSTRAINT IF EXISTS properties_v2_legal_owner_party_id_fkey;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'properties_v2' AND column_name = 'legal_owner_party_id'
  ) THEN
    ALTER TABLE public.properties_v2
      ADD CONSTRAINT properties_v2_legal_owner_party_id_fkey
      FOREIGN KEY (legal_owner_party_id)
      REFERENCES public.parties(id)
      ON DELETE SET NULL;
  END IF;
END $$;
