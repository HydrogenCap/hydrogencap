-- ============================================
-- TENANT MANAGEMENT SUITE - DATABASE SCHEMA
-- ============================================

-- Create enums for tenant management
CREATE TYPE room_status AS ENUM ('vacant', 'occupied', 'notice', 'maintenance');
CREATE TYPE room_type AS ENUM ('single', 'double', 'ensuite', 'studio');
CREATE TYPE tenant_status AS ENUM ('prospect', 'active', 'past', 'blacklisted');
CREATE TYPE tenancy_status AS ENUM ('pending', 'active', 'notice', 'ended');
CREATE TYPE rent_status AS ENUM ('upcoming', 'due', 'paid', 'partial', 'overdue');
CREATE TYPE maintenance_urgency AS ENUM ('emergency', 'urgent', 'normal', 'low');
CREATE TYPE maintenance_status AS ENUM ('new', 'acknowledged', 'scheduled', 'in_progress', 'completed', 'closed');
CREATE TYPE maintenance_category AS ENUM ('plumbing', 'electrical', 'heating', 'appliance', 'damp_mould', 'structural', 'security', 'cleaning', 'garden', 'other');
CREATE TYPE update_creator_type AS ENUM ('manager', 'tenant', 'contractor', 'system');

-- ============================================
-- ROOMS TABLE
-- ============================================
CREATE TABLE public.rooms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  room_number text,
  floor integer DEFAULT 0,
  room_type room_type NOT NULL DEFAULT 'single',
  target_rent_pcm numeric(10,2),
  status room_status NOT NULL DEFAULT 'vacant',
  description text,
  amenities text[],
  square_footage numeric(8,2),
  photos text[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- TENANTS TABLE
-- ============================================
CREATE TABLE public.tenants (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text,
  phone text,
  date_of_birth date,
  national_insurance text,
  emergency_contact_name text,
  emergency_contact_phone text,
  emergency_contact_relationship text,
  employment_status text,
  employer_name text,
  employer_address text,
  annual_income numeric(12,2),
  guarantor_name text,
  guarantor_email text,
  guarantor_phone text,
  guarantor_address text,
  previous_address text,
  previous_landlord_name text,
  previous_landlord_phone text,
  reference_notes text,
  portal_user_id uuid REFERENCES auth.users(id),
  status tenant_status NOT NULL DEFAULT 'prospect',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- TENANCIES TABLE
-- ============================================
CREATE TABLE public.tenancies (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  rent_amount_pcm numeric(10,2) NOT NULL,
  rent_due_day integer NOT NULL DEFAULT 1 CHECK (rent_due_day >= 1 AND rent_due_day <= 28),
  deposit_amount numeric(10,2),
  deposit_scheme text,
  deposit_reference text,
  deposit_protected_date date,
  tenancy_agreement_url text,
  status tenancy_status NOT NULL DEFAULT 'pending',
  notice_date date,
  notice_period_weeks integer DEFAULT 4,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- RENT SCHEDULE TABLE
-- ============================================
CREATE TABLE public.rent_schedule (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  due_date date NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  rent_amount numeric(10,2) NOT NULL,
  additional_charges numeric(10,2) DEFAULT 0,
  amount_paid numeric(10,2) DEFAULT 0,
  amount_outstanding numeric(10,2) GENERATED ALWAYS AS (rent_amount + COALESCE(additional_charges, 0) - COALESCE(amount_paid, 0)) STORED,
  status rent_status NOT NULL DEFAULT 'upcoming',
  reminder_sent_at timestamp with time zone,
  warning_sent_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- RENT PAYMENTS TABLE
-- ============================================
CREATE TABLE public.rent_payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tenancy_id uuid NOT NULL REFERENCES public.tenancies(id) ON DELETE CASCADE,
  rent_schedule_id uuid REFERENCES public.rent_schedule(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  payment_date date NOT NULL,
  payment_method text,
  reference text,
  is_reconciled boolean DEFAULT false,
  notes text,
  recorded_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- MAINTENANCE REQUESTS TABLE
-- ============================================
CREATE TABLE public.maintenance_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE SET NULL,
  category maintenance_category NOT NULL DEFAULT 'other',
  title text NOT NULL,
  description text NOT NULL,
  location_in_property text,
  urgency maintenance_urgency NOT NULL DEFAULT 'normal',
  photos text[],
  status maintenance_status NOT NULL DEFAULT 'new',
  contractor_job_id uuid REFERENCES public.contractor_jobs(id) ON DELETE SET NULL,
  scheduled_date date,
  completed_at timestamp with time zone,
  tenant_rating integer CHECK (tenant_rating >= 1 AND tenant_rating <= 5),
  tenant_feedback text,
  internal_notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- MAINTENANCE UPDATES TABLE
-- ============================================
CREATE TABLE public.maintenance_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid NOT NULL REFERENCES public.maintenance_requests(id) ON DELETE CASCADE,
  update_type text NOT NULL,
  message text NOT NULL,
  new_status maintenance_status,
  visible_to_tenant boolean NOT NULL DEFAULT true,
  photos text[],
  created_by uuid REFERENCES auth.users(id),
  created_by_type update_creator_type NOT NULL DEFAULT 'manager',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_rooms_property_id ON public.rooms(property_id);
CREATE INDEX idx_rooms_status ON public.rooms(status);
CREATE INDEX idx_tenants_org_id ON public.tenants(org_id);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenancies_tenant_id ON public.tenancies(tenant_id);
CREATE INDEX idx_tenancies_room_id ON public.tenancies(room_id);
CREATE INDEX idx_tenancies_status ON public.tenancies(status);
CREATE INDEX idx_rent_schedule_tenancy_id ON public.rent_schedule(tenancy_id);
CREATE INDEX idx_rent_schedule_due_date ON public.rent_schedule(due_date);
CREATE INDEX idx_rent_schedule_status ON public.rent_schedule(status);
CREATE INDEX idx_rent_payments_tenancy_id ON public.rent_payments(tenancy_id);
CREATE INDEX idx_maintenance_requests_property_id ON public.maintenance_requests(property_id);
CREATE INDEX idx_maintenance_requests_status ON public.maintenance_requests(status);
CREATE INDEX idx_maintenance_updates_request_id ON public.maintenance_updates(request_id);

-- ============================================
-- RLS POLICIES
-- ============================================
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_updates ENABLE ROW LEVEL SECURITY;

-- Rooms policies
CREATE POLICY "Org members manage rooms" ON public.rooms FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants policies
CREATE POLICY "Org members manage tenants" ON public.tenants FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants can view own profile via portal
CREATE POLICY "Tenants view own profile" ON public.tenants FOR SELECT
  USING (portal_user_id = auth.uid());

-- Tenancies policies
CREATE POLICY "Org members manage tenancies" ON public.tenancies FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants can view own tenancies
CREATE POLICY "Tenants view own tenancies" ON public.tenancies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenants t 
    WHERE t.id = tenancies.tenant_id 
    AND t.portal_user_id = auth.uid()
  ));

-- Rent schedule policies
CREATE POLICY "Org members manage rent schedule" ON public.rent_schedule FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants can view own rent schedule
CREATE POLICY "Tenants view own rent schedule" ON public.rent_schedule FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenancies tn
    JOIN public.tenants t ON t.id = tn.tenant_id
    WHERE tn.id = rent_schedule.tenancy_id
    AND t.portal_user_id = auth.uid()
  ));

-- Rent payments policies
CREATE POLICY "Org members manage rent payments" ON public.rent_payments FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants can view own payments
CREATE POLICY "Tenants view own payments" ON public.rent_payments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenancies tn
    JOIN public.tenants t ON t.id = tn.tenant_id
    WHERE tn.id = rent_payments.tenancy_id
    AND t.portal_user_id = auth.uid()
  ));

-- Maintenance requests policies
CREATE POLICY "Org members manage maintenance" ON public.maintenance_requests FOR ALL
  USING (user_has_org_access(org_id));

-- Tenants can view own maintenance requests
CREATE POLICY "Tenants view own maintenance" ON public.maintenance_requests FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = maintenance_requests.tenant_id
    AND t.portal_user_id = auth.uid()
  ));

-- Tenants can create maintenance requests
CREATE POLICY "Tenants create maintenance" ON public.maintenance_requests FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = maintenance_requests.tenant_id
    AND t.portal_user_id = auth.uid()
  ));

-- Maintenance updates policies
CREATE POLICY "Org members manage updates" ON public.maintenance_updates FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.maintenance_requests mr
    WHERE mr.id = maintenance_updates.request_id
    AND user_has_org_access(mr.org_id)
  ));

-- Tenants can view visible updates
CREATE POLICY "Tenants view visible updates" ON public.maintenance_updates FOR SELECT
  USING (
    visible_to_tenant = true
    AND EXISTS (
      SELECT 1 FROM public.maintenance_requests mr
      JOIN public.tenants t ON t.id = mr.tenant_id
      WHERE mr.id = maintenance_updates.request_id
      AND t.portal_user_id = auth.uid()
    )
  );

-- Tenants can create updates
CREATE POLICY "Tenants create updates" ON public.maintenance_updates FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.maintenance_requests mr
    JOIN public.tenants t ON t.id = mr.tenant_id
    WHERE mr.id = maintenance_updates.request_id
    AND t.portal_user_id = auth.uid()
  ));

-- ============================================
-- TRIGGERS & FUNCTIONS
-- ============================================

-- Function to update room status based on tenancy changes
CREATE OR REPLACE FUNCTION public.update_room_status_on_tenancy_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When tenancy becomes active, set room to occupied
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    UPDATE public.rooms SET status = 'occupied', updated_at = now()
    WHERE id = NEW.room_id;
    
    -- Also update tenant status to active
    UPDATE public.tenants SET status = 'active', updated_at = now()
    WHERE id = NEW.tenant_id AND status = 'prospect';
  END IF;
  
  -- When tenancy ends, set room to vacant
  IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
    UPDATE public.rooms SET status = 'vacant', updated_at = now()
    WHERE id = NEW.room_id;
    
    -- Update tenant status to past
    UPDATE public.tenants SET status = 'past', updated_at = now()
    WHERE id = NEW.tenant_id;
  END IF;
  
  -- When tenancy is in notice period
  IF NEW.status = 'notice' AND OLD.status != 'notice' THEN
    UPDATE public.rooms SET status = 'notice', updated_at = now()
    WHERE id = NEW.room_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_room_on_tenancy
  AFTER INSERT OR UPDATE ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_room_status_on_tenancy_change();

-- Function to generate rent schedule for a tenancy
CREATE OR REPLACE FUNCTION public.generate_rent_schedule(p_tenancy_id uuid, p_months integer DEFAULT 12)
RETURNS integer AS $$
DECLARE
  v_tenancy RECORD;
  v_due_date date;
  v_period_start date;
  v_period_end date;
  v_count integer := 0;
  i integer;
BEGIN
  -- Get tenancy details
  SELECT * INTO v_tenancy FROM public.tenancies WHERE id = p_tenancy_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tenancy not found';
  END IF;
  
  -- Generate schedule for each month
  FOR i IN 0..(p_months - 1) LOOP
    -- Calculate dates
    v_period_start := v_tenancy.start_date + (i || ' months')::interval;
    v_period_end := v_period_start + '1 month'::interval - '1 day'::interval;
    v_due_date := make_date(
      EXTRACT(YEAR FROM v_period_start)::integer,
      EXTRACT(MONTH FROM v_period_start)::integer,
      LEAST(v_tenancy.rent_due_day, EXTRACT(DAY FROM (v_period_end + '1 day'::interval - '1 month'::interval))::integer)
    );
    
    -- Don't generate if past end date
    IF v_tenancy.end_date IS NOT NULL AND v_due_date > v_tenancy.end_date THEN
      EXIT;
    END IF;
    
    -- Insert schedule item if not exists
    INSERT INTO public.rent_schedule (org_id, tenancy_id, due_date, period_start, period_end, rent_amount, status)
    VALUES (
      v_tenancy.org_id,
      p_tenancy_id,
      v_due_date,
      v_period_start,
      v_period_end,
      v_tenancy.rent_amount_pcm,
      CASE 
        WHEN v_due_date < CURRENT_DATE THEN 'overdue'
        WHEN v_due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END
    )
    ON CONFLICT DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update rent schedule status after payment
CREATE OR REPLACE FUNCTION public.update_rent_schedule_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_total_paid numeric;
  v_schedule RECORD;
BEGIN
  -- Get updated payment total for this schedule item
  IF NEW.rent_schedule_id IS NOT NULL THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.rent_payments
    WHERE rent_schedule_id = NEW.rent_schedule_id;
    
    -- Get schedule details
    SELECT * INTO v_schedule FROM public.rent_schedule WHERE id = NEW.rent_schedule_id;
    
    -- Update schedule
    UPDATE public.rent_schedule
    SET 
      amount_paid = v_total_paid,
      status = CASE
        WHEN v_total_paid >= (v_schedule.rent_amount + COALESCE(v_schedule.additional_charges, 0)) THEN 'paid'
        WHEN v_total_paid > 0 THEN 'partial'
        WHEN v_schedule.due_date < CURRENT_DATE THEN 'overdue'
        WHEN v_schedule.due_date = CURRENT_DATE THEN 'due'
        ELSE 'upcoming'
      END,
      updated_at = now()
    WHERE id = NEW.rent_schedule_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_schedule_on_payment
  AFTER INSERT OR UPDATE ON public.rent_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_rent_schedule_on_payment();

-- Function to auto-generate rent schedule when tenancy created/activated
CREATE OR REPLACE FUNCTION public.auto_generate_rent_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- Generate schedule when tenancy becomes active
  IF NEW.status = 'active' AND (OLD IS NULL OR OLD.status != 'active') THEN
    PERFORM public.generate_rent_schedule(NEW.id, 12);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_auto_rent_schedule
  AFTER INSERT OR UPDATE ON public.tenancies
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_generate_rent_schedule();

-- Updated_at triggers
CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenancies_updated_at BEFORE UPDATE ON public.tenancies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_schedule_updated_at BEFORE UPDATE ON public.rent_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON public.maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();