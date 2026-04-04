-- Webhook endpoints registered by each organisation
CREATE TABLE public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.organizations(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  description TEXT,
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_endpoints_org_id ON public.webhook_endpoints(org_id);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org webhook endpoints"
  ON public.webhook_endpoints FOR SELECT
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can insert own org webhook endpoints"
  ON public.webhook_endpoints FOR INSERT
  WITH CHECK (public.user_has_org_access(org_id));

CREATE POLICY "Users can update own org webhook endpoints"
  ON public.webhook_endpoints FOR UPDATE
  USING (public.user_has_org_access(org_id));

CREATE POLICY "Users can delete own org webhook endpoints"
  ON public.webhook_endpoints FOR DELETE
  USING (public.user_has_org_access(org_id));


-- Delivery log for every webhook dispatch attempt
CREATE TABLE public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  attempt_count INT DEFAULT 1,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed', 'retrying')),
  next_retry_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_deliveries_endpoint_id ON public.webhook_deliveries(endpoint_id);
CREATE INDEX idx_webhook_deliveries_status ON public.webhook_deliveries(status);

ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org webhook deliveries"
  ON public.webhook_deliveries FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints ep
      WHERE ep.id = webhook_deliveries.endpoint_id
        AND public.user_has_org_access(ep.org_id)
    )
  );

CREATE POLICY "Users can insert own org webhook deliveries"
  ON public.webhook_deliveries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.webhook_endpoints ep
      WHERE ep.id = webhook_deliveries.endpoint_id
        AND public.user_has_org_access(ep.org_id)
    )
  );
