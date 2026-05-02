BEGIN;

CREATE TEMP TABLE tmp_share_class_id_remap (
  v1_id uuid PRIMARY KEY,
  v2_id uuid NOT NULL
);

INSERT INTO tmp_share_class_id_remap (v1_id, v2_id)
SELECT DISTINCT sc1.id, sc2.id
FROM public.share_classes sc1
JOIN public.companies c ON c.id = sc1.company_id
JOIN public.legal_entities le ON le.company_number = c.company_number
JOIN public.share_classes_v2 sc2 ON sc2.entity_id = le.id AND sc2.class_name = sc1.name;

DO $$
DECLARE
  unresolved_count int;
  unresolved_sample text;
BEGIN
  SELECT count(*), string_agg(format('(%s -> %s)', sh.id, sh.share_class_id), ', ')
    INTO unresolved_count, unresolved_sample
  FROM (
    SELECT id, share_class_id FROM public.shareholdings
    WHERE share_class_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM tmp_share_class_id_remap r WHERE r.v1_id = share_class_id)
    LIMIT 5
  ) sh;
  IF unresolved_count > 0 THEN
    RAISE EXCEPTION 'Bridge incomplete: % unresolvable shareholdings: %', unresolved_count, unresolved_sample;
  END IF;
END $$;

ALTER TABLE public.shareholdings DROP CONSTRAINT IF EXISTS shareholdings_share_class_id_fkey;

DO $$
DECLARE updated_rows int;
BEGIN
  UPDATE public.shareholdings sh
  SET share_class_id = r.v2_id
  FROM tmp_share_class_id_remap r
  WHERE sh.share_class_id = r.v1_id;
  GET DIAGNOSTICS updated_rows = ROW_COUNT;
  RAISE NOTICE 'Backfilled % shareholdings rows', updated_rows;
END $$;

DO $$
DECLARE leftover int;
BEGIN
  SELECT count(*) INTO leftover
  FROM public.shareholdings sh
  WHERE sh.share_class_id IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.share_classes sc WHERE sc.id = sh.share_class_id)
    AND NOT EXISTS (SELECT 1 FROM public.share_classes_v2 sc2 WHERE sc2.id = sh.share_class_id);
  IF leftover > 0 THEN
    RAISE EXCEPTION 'Post-flight drift = % (expected 0)', leftover;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shareholdings_share_class_id_fkey') THEN
    ALTER TABLE public.shareholdings
      ADD CONSTRAINT shareholdings_share_class_id_fkey
      FOREIGN KEY (share_class_id) REFERENCES public.share_classes_v2(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP TABLE tmp_share_class_id_remap;

COMMIT;