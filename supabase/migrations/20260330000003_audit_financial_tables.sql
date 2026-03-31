-- Add audit triggers to financial tables that currently have no audit trail.
-- The audit_trigger_function() is defined in
-- 20260226235935_b3693823-0b16-45df-bc8c-a4c660bc533c.sql and logs all
-- INSERT / UPDATE / DELETE operations into public.audit_log.

CREATE TRIGGER audit_income
  AFTER INSERT OR UPDATE OR DELETE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_costs
  AFTER INSERT OR UPDATE OR DELETE ON public.costs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_rent_payments
  AFTER INSERT OR UPDATE OR DELETE ON public.rent_payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_distributions
  AFTER INSERT OR UPDATE OR DELETE ON public.distributions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_investor_distributions
  AFTER INSERT OR UPDATE OR DELETE ON public.investor_distributions
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();

CREATE TRIGGER audit_work_order_costs
  AFTER INSERT OR UPDATE OR DELETE ON public.work_order_costs
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_function();
