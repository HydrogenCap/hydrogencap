DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'v1_freeze_guard'
      AND tgrelid = 'public.loans'::regclass
  ) THEN
    CREATE TRIGGER v1_freeze_guard
      BEFORE INSERT OR UPDATE OR DELETE ON public.loans
      FOR EACH ROW EXECUTE FUNCTION public.v1_freeze_guard();
  END IF;
END $$;