
-- Add room_id to compliance_documents_v2 for room-level compliance (e.g. HMO fire doors per room)
ALTER TABLE public.compliance_documents_v2
  ADD COLUMN room_id UUID REFERENCES public.rooms_v2(id) ON DELETE SET NULL;

-- Add room_id to compliance_requirements_v2 for room-level requirements
ALTER TABLE public.compliance_requirements_v2
  ADD COLUMN room_id UUID REFERENCES public.rooms_v2(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX idx_compliance_docs_v2_room_id ON public.compliance_documents_v2(room_id) WHERE room_id IS NOT NULL;
CREATE INDEX idx_compliance_reqs_v2_room_id ON public.compliance_requirements_v2(room_id) WHERE room_id IS NOT NULL;
