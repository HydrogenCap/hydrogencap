
-- Update validation trigger to also check shares_held against issued_shares
CREATE OR REPLACE FUNCTION public.validate_shareholder_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  total_pct NUMERIC;
  total_shares NUMERIC;
  v_issued_shares INTEGER;
BEGIN
  -- Calculate total percentage for this entity (excluding current row for UPDATE)
  SELECT COALESCE(SUM(percentage), 0)
  INTO total_pct
  FROM public.entity_shareholders
  WHERE entity_id = NEW.entity_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  total_pct := total_pct + NEW.percentage;

  IF total_pct > 100.01 THEN
    RAISE EXCEPTION 'Total shareholder percentage (%) exceeds 100%% for entity %',
      ROUND(total_pct, 2), NEW.entity_id;
  END IF;

  -- Validate shares_held against issued_shares if set
  SELECT issued_shares INTO v_issued_shares
  FROM public.legal_entities
  WHERE id = NEW.entity_id;

  IF v_issued_shares IS NOT NULL THEN
    SELECT COALESCE(SUM(shares_held), 0)
    INTO total_shares
    FROM public.entity_shareholders
    WHERE entity_id = NEW.entity_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

    total_shares := total_shares + NEW.shares_held;

    IF total_shares > v_issued_shares THEN
      RAISE EXCEPTION 'Total shares held (%) exceeds issued shares (%) for entity %',
        total_shares, v_issued_shares, NEW.entity_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
