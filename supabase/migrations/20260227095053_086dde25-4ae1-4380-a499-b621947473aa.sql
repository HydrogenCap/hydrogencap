
-- 1. Add issued_shares column to legal_entities
ALTER TABLE public.legal_entities
ADD COLUMN issued_shares integer DEFAULT NULL;

COMMENT ON COLUMN public.legal_entities.issued_shares IS 'Total issued share capital for this entity. Used to validate shareholder percentages.';

-- 2. Create trigger to enforce entity_shareholders total percentage <= 100%
CREATE OR REPLACE FUNCTION public.validate_shareholder_total()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  total_pct NUMERIC;
BEGIN
  -- Calculate total percentage for this entity (excluding current row for UPDATE)
  SELECT COALESCE(SUM(percentage), 0)
  INTO total_pct
  FROM public.entity_shareholders
  WHERE entity_id = NEW.entity_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  -- Add the new/updated row's percentage
  total_pct := total_pct + NEW.percentage;

  IF total_pct > 100.01 THEN
    RAISE EXCEPTION 'Total shareholder percentage (%) exceeds 100%% for entity %',
      ROUND(total_pct, 2), NEW.entity_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_shareholder_total
BEFORE INSERT OR UPDATE ON public.entity_shareholders
FOR EACH ROW
EXECUTE FUNCTION public.validate_shareholder_total();

-- 3. Create trigger to validate shares_held against issued_shares
CREATE OR REPLACE FUNCTION public.validate_shares_against_issued()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_issued_shares INTEGER;
  v_total_shares INTEGER;
BEGIN
  -- Get issued_shares for the entity
  SELECT issued_shares INTO v_issued_shares
  FROM public.legal_entities
  WHERE id = NEW.entity_id;

  -- Skip validation if issued_shares not set
  IF v_issued_shares IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate total shares held (excluding current row for UPDATE)
  SELECT COALESCE(SUM(shares_held), 0)
  INTO v_total_shares
  FROM public.entity_shareholders
  WHERE entity_id = NEW.entity_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');

  v_total_shares := v_total_shares + NEW.shares_held;

  IF v_total_shares > v_issued_shares THEN
    RAISE EXCEPTION 'Total shares held (%) exceeds issued shares (%) for entity %',
      v_total_shares, v_issued_shares, NEW.entity_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_shares_against_issued
BEFORE INSERT OR UPDATE ON public.entity_shareholders
FOR EACH ROW
EXECUTE FUNCTION public.validate_shares_against_issued();

-- 4. Add check constraint on percentage range
ALTER TABLE public.entity_shareholders
ADD CONSTRAINT chk_percentage_range CHECK (percentage >= 0 AND percentage <= 100);

-- 5. Add check constraint on shares_held non-negative
ALTER TABLE public.entity_shareholders
ADD CONSTRAINT chk_shares_held_positive CHECK (shares_held >= 0);

-- 6. Add check constraint on issued_shares positive
ALTER TABLE public.legal_entities
ADD CONSTRAINT chk_issued_shares_positive CHECK (issued_shares IS NULL OR issued_shares > 0);
